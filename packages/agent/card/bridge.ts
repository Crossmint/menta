/**
 * The card's side of the MCP Apps bridge (SEP-1865): JSON-RPC 2.0 over
 * postMessage with the host (or its sandbox proxy), without the SDK runtime.
 * Only messages from the parent window are read.
 */

type Waiter = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

let nextId = 1;
const waiting = new Map<number, Waiter>();

export interface BridgeHandlers {
  /** A request from the host (`ui/resource-teardown`, `ping`); return its result. */
  onRequest(method: string): Record<string, unknown> | null;
  onNotification(method: string, params: unknown): void;
}

export function post(message: Record<string, unknown>) {
  window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*");
}

export function request<T = Record<string, unknown>>(
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 15_000,
): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
    waiting.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value as T);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    post({ id, method, params });
  });
}

export function notify(method: string, params: Record<string, unknown> = {}) {
  post({ method, params });
}

export function listen(handlers: BridgeHandlers) {
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) {
      return;
    }
    const message = event.data as Record<string, unknown> | null;
    if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") {
      return;
    }
    const { id, method } = message;
    if (typeof method === "string") {
      if (typeof id === "number" || typeof id === "string") {
        const result = handlers.onRequest(method);
        post(
          result
            ? { id, result }
            : { id, error: { code: -32601, message: "Method not found" } },
        );
      } else {
        handlers.onNotification(method, message.params);
      }
      return;
    }
    if (typeof id === "number") {
      const entry = waiting.get(id);
      waiting.delete(id);
      if (!entry) {
        return;
      }
      if ("error" in message) {
        const error = message.error as { message?: unknown } | null;
        entry.reject(
          new Error(
            typeof error?.message === "string" ? error.message : "Host error",
          ),
        );
      } else {
        entry.resolve(message.result);
      }
    }
  });
}
