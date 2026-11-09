/** An agent the user allowed through Stytch Connected Apps (GET /api/connections). */
export interface Connection {
  readonly id: string;
  readonly name: string;
  readonly logoUrl?: string | null;
  /** When it last used Menta; null when it hasn't since we started noting it. */
  readonly lastUsedAt?: string | null;
  /** The name and version it gives itself ("openai-mcp 1.0.0"), when it sent one. */
  readonly client?: string | null;
}

/** The user's connected agents; null when they couldn't be loaded. */
export async function loadConnections(): Promise<Connection[] | null> {
  try {
    const response = await fetch("/api/connections", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const body: { connections?: Connection[] } = await response.json();
    return body.connections ?? null;
  } catch {
    return null;
  }
}
