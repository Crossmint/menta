import {
  checkoutCardSecureScript,
  checkoutCardSecureVersion,
} from "@oca/agent/mcp";

/**
 * The checkout card's secure-step script: Crossmint's components, loaded by
 * the card inside ChatGPT or Claude only when a payment or private field is
 * waiting. Public code, no data; versioned URLs are cached for good.
 */
export function GET(request: Request) {
  const current =
    new URL(request.url).searchParams.get("v") === checkoutCardSecureVersion;
  return new Response(checkoutCardSecureScript, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": current
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
