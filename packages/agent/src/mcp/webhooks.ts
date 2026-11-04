import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

/**
 * Outbound webhooks for MCP Events: Standard Webhooks signing and a transport
 * that only reaches public HTTPS endpoints. Callback URLs come from the MCP
 * client, so every request resolves the host itself, refuses non-public
 * addresses at connect time (no DNS rebinding window) and never follows
 * redirects.
 */

/** Delivery bodies above this are refused (MCP Events delivery profile). */
export const MAX_BODY_BYTES = 256 * 1024;
/** How much of a response we read: enough for a challenge echo. */
const MAX_RESPONSE_BYTES = 64 * 1024;

/** The categories the spec allows in `deliveryStatus.lastError` and `-32015` data. */
export type FailureReason =
  | "connection_refused"
  | "timeout"
  | "tls_error"
  | "http_4xx"
  | "http_5xx"
  | "challenge_failed";

export class WebhookError extends Error {
  constructor(readonly reason: FailureReason) {
    super(`Webhook delivery failed: ${reason}`);
    this.name = "WebhookError";
  }
}

/**
 * The HMAC key in a Standard Webhooks secret: `whsec_` plus base64 of 24 to
 * 64 bytes (what MCP Events requires). Null for anything else.
 */
export function signingKey(secret: string): Buffer | null {
  if (!secret.startsWith("whsec_")) {
    return null;
  }
  const encoded = secret.slice("whsec_".length);
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    return null;
  }
  const key = Buffer.from(encoded, "base64");
  return key.length >= 24 && key.length <= 64 ? key : null;
}

/**
 * The `webhook-signature` header: `v1,<base64 HMAC-SHA256>` over
 * `id.timestamp.body` for each key, space-separated (several during a secret
 * rotation).
 */
export function sign(
  keys: readonly Buffer[],
  id: string,
  timestamp: number,
  body: string,
) {
  return keys
    .map(
      (key) =>
        `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`,
    )
    .join(" ");
}

// IANA special-purpose IPv4 registry (non-global entries), plus multicast and reserved.
const blockedV4: readonly [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.31.196.0", 24],
  ["192.52.193.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["192.175.48.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
// Inside global unicast (2000::/3): IETF protocol assignments (Teredo, ORCHID,
// benchmarking…), documentation, 6to4 (embeds IPv4) and the 3fff:: documentation block.
const blockedV6: readonly [string, number][] = [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
];
const blocked = new BlockList();
for (const [network, prefix] of blockedV4) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of blockedV6) {
  blocked.addSubnet(network, prefix, "ipv6");
}
const globalUnicastV6 = new BlockList();
globalUnicastV6.addSubnet("2000::", 3, "ipv6");

/**
 * Whether an IP address is globally routable. IPv6 must be global unicast
 * (2000::/3), which also rules out IPv4-mapped, NAT64, loopback, link-local
 * and unique-local addresses.
 */
export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    return !blocked.check(address, "ipv4");
  }
  if (family === 6) {
    return (
      globalUnicastV6.check(address, "ipv6") && !blocked.check(address, "ipv6")
    );
  }
  return false;
}

const internalNames =
  /(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/i;

/**
 * Why a callback URL can't be used, or null when it can: https on the default
 * port, no credentials, and a public host. Addresses are checked again when
 * each request connects.
 */
export function callbackProblem(value: string): string | null {
  if (value.length > 2048) {
    return "The callback URL is too long.";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "The callback URL is not a valid URL.";
  }
  if (url.protocol !== "https:") {
    return "The callback URL must use https.";
  }
  if (url.username || url.password) {
    return "The callback URL must not carry credentials.";
  }
  if (url.port && url.port !== "443") {
    return "The callback URL must use the default https port.";
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    return isPublicAddress(host)
      ? null
      : "The callback URL must point to a public address.";
  }
  if (!host.includes(".") || internalNames.test(host.replace(/\.$/, ""))) {
    return "The callback URL must point to a public host.";
  }
  return null;
}

/** Resolves every address for a host and refuses the connection if any is not public. */
export const publicOnlyLookup = ((
  hostname: string,
  options: { family?: number | string; all?: boolean },
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number,
  ) => void,
) => {
  const family =
    options.family === 6 || options.family === "IPv6"
      ? 6
      : options.family === 4 || options.family === "IPv4"
        ? 4
        : 0;
  dnsLookup(hostname, { all: true, family }, (error, addresses) => {
    if (error) {
      callback(error, []);
      return;
    }
    const first = addresses[0];
    if (!first || addresses.some((item) => !isPublicAddress(item.address))) {
      const refused: NodeJS.ErrnoException = new Error(
        "Callback host resolves to a non-public address.",
      );
      refused.code = "ECONNREFUSED";
      callback(refused, []);
      return;
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, first.address, first.family);
    }
  });
}) as unknown as LookupFunction;

export interface WebhookResponse {
  readonly status: number;
  /** At most 64 KiB of the response body. */
  readonly body: string;
}

/** Sends one POST; throws WebhookError on network failure. Injected in tests. */
export type WebhookTransport = (
  url: URL,
  request: {
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
    readonly timeoutMs: number;
  },
) => Promise<WebhookResponse>;

function failureOf(error: unknown): FailureReason {
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  if (code === "ETIMEDOUT" || code === "ABORT_ERR") {
    return "timeout";
  }
  if (
    code.startsWith("ERR_TLS") ||
    code.startsWith("ERR_SSL") ||
    code.includes("CERT") ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  ) {
    return "tls_error";
  }
  return "connection_refused";
}

/**
 * The real transport: node:https to the hostname (so TLS verifies it), with
 * the public-only resolver, a hard deadline and no redirects (node:https
 * never follows them; a 3xx is just a failed delivery).
 */
export const publicTransport: WebhookTransport = (url, request) =>
  new Promise((resolve, reject) => {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (callbackProblem(url.href) || (isIP(host) && !isPublicAddress(host))) {
      reject(new WebhookError("connection_refused"));
      return;
    }
    let settled = false;
    const finish = (error: WebhookError | null, value?: WebhookResponse) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(deadline);
      if (error) {
        reject(error);
      } else if (value) {
        resolve(value);
      }
    };
    const outgoing = httpsRequest(
      {
        host,
        servername: isIP(host) ? undefined : host,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        agent: false,
        lookup: publicOnlyLookup,
        headers: {
          ...request.headers,
          "content-length": String(Buffer.byteLength(request.body)),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          if (size < MAX_RESPONSE_BYTES) {
            chunks.push(chunk);
            size += chunk.length;
          }
        });
        response.on("end", () =>
          finish(null, {
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks)
              .subarray(0, MAX_RESPONSE_BYTES)
              .toString("utf8"),
          }),
        );
        response.on("error", (error) =>
          finish(new WebhookError(failureOf(error))),
        );
      },
    );
    const deadline = setTimeout(() => {
      finish(new WebhookError("timeout"));
      outgoing.destroy();
    }, request.timeoutMs);
    outgoing.on("error", (error) => finish(new WebhookError(failureOf(error))));
    outgoing.end(request.body);
  });

/**
 * POSTs one signed body: Standard Webhooks headers plus X-MCP-Subscription-Id.
 * The body is serialized once by the caller and signed as sent; each call
 * signs with a fresh timestamp. Returns the response (any status) or throws
 * WebhookError when nothing came back.
 */
export async function postSigned({
  url,
  id,
  subscriptionId,
  body,
  keys,
  transport = publicTransport,
  now = Date.now,
  timeoutMs = 10_000,
}: {
  url: string;
  id: string;
  subscriptionId: string;
  body: string;
  keys: readonly Buffer[];
  transport?: WebhookTransport;
  now?: () => number;
  timeoutMs?: number;
}): Promise<WebhookResponse> {
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
    throw new RangeError("Webhook body exceeds 256 KiB.");
  }
  const timestamp = Math.floor(now() / 1000);
  return transport(new URL(url), {
    headers: {
      "content-type": "application/json",
      "user-agent": "Menta-MCP-Events/1",
      "webhook-id": id,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": sign(keys, id, timestamp, body),
      "x-mcp-subscription-id": subscriptionId,
    },
    body,
    timeoutMs,
  });
}

/**
 * POSTs one JSON body with `Authorization: Bearer <key>` (Grok Bot routine
 * webhooks): the same public-only transport, size cap and deadline as signed
 * deliveries. The key is never logged.
 */
export async function postBearer({
  url,
  key,
  body,
  transport = publicTransport,
  timeoutMs = 10_000,
}: {
  url: string;
  key: string;
  body: string;
  transport?: WebhookTransport;
  timeoutMs?: number;
}): Promise<WebhookResponse> {
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
    throw new RangeError("Webhook body exceeds 256 KiB.");
  }
  return transport(new URL(url), {
    headers: {
      "content-type": "application/json",
      "user-agent": "Menta-Grok-Bot-Updates/1",
      authorization: `Bearer ${key}`,
    },
    body,
    timeoutMs,
  });
}

/** The failure category for a non-2xx status. */
export function statusFailure(status: number): FailureReason {
  return status >= 500 ? "http_5xx" : "http_4xx";
}

/**
 * The callback handshake: a signed `verification` envelope with a fresh,
 * single-use challenge, which the endpoint must echo in a 2xx JSON body.
 * Resolves on success; throws WebhookError with the category otherwise.
 */
export async function verifyCallback(options: {
  url: string;
  subscriptionId: string;
  keys: readonly Buffer[];
  transport?: WebhookTransport;
  now?: () => number;
}) {
  const challenge = randomBytes(24).toString("base64url");
  const response = await postSigned({
    ...options,
    id: `msg_verification_${randomBytes(12).toString("hex")}`,
    body: JSON.stringify({ type: "verification", challenge }),
  });
  if (response.status < 200 || response.status >= 300) {
    throw new WebhookError(statusFailure(response.status));
  }
  let echoed: unknown;
  try {
    echoed = (JSON.parse(response.body) as { challenge?: unknown }).challenge;
  } catch {
    throw new WebhookError("challenge_failed");
  }
  const expected = Buffer.from(challenge);
  const actual = Buffer.from(typeof echoed === "string" ? echoed : "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new WebhookError("challenge_failed");
  }
}
