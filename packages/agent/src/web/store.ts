import { neon } from "@neondatabase/serverless";
import type { SessionAuthContext } from "eve/context";

export interface Conversation {
  readonly sessionId: string;
  readonly title: string | null;
  readonly createdAt: string;
}

/** Maps Eve web sessions to their owner. Eve keeps the conversations themselves. */
export interface SessionOwnerStore {
  get(sessionId: string): Promise<SessionAuthContext | null>;
  /** Binding is immutable: a session never changes owner. */
  bind(
    sessionId: string,
    owner: SessionAuthContext,
    title: string | null,
  ): Promise<void>;
  list(owner: SessionAuthContext, limit?: number): Promise<Conversation[]>;
  /** Replace the conversation's sidebar title. */
  rename(
    sessionId: string,
    owner: SessionAuthContext,
    title: string,
  ): Promise<void>;
  /**
   * Drop a conversation from the owner's list. Eve keeps its data, but the
   * channel refuses every route for a session without an owner, so it's gone
   * for good. False when the owner had no such conversation.
   */
  forget(sessionId: string, owner: SessionAuthContext): Promise<boolean>;
}

type Query = (
  text: string,
  parameters: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

function principal(issuer: string, subject: string): SessionAuthContext {
  return {
    authenticator: "stytch",
    principalType: "user",
    principalId: subject,
    issuer,
    subject,
    attributes: {},
  };
}

export function createSqlSessionOwnerStore(query: Query): SessionOwnerStore {
  return {
    async get(sessionId) {
      const [row] = await query(
        "SELECT issuer, subject FROM web_session_owners WHERE session_id = $1",
        [sessionId],
      );
      return row ? principal(String(row.issuer), String(row.subject)) : null;
    },
    async bind(sessionId, owner, title) {
      const rows = await query(
        `INSERT INTO web_session_owners (session_id, issuer, subject, title)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id) DO UPDATE
         SET title = COALESCE(web_session_owners.title, EXCLUDED.title)
         WHERE web_session_owners.issuer = EXCLUDED.issuer
           AND web_session_owners.subject = EXCLUDED.subject
         RETURNING session_id`,
        [sessionId, owner.issuer, owner.subject, title],
      );
      if (rows.length !== 1) {
        throw new Error("Session belongs to another user");
      }
    },
    async rename(sessionId, owner, title) {
      await query(
        "UPDATE web_session_owners SET title = $4 WHERE session_id = $1 AND issuer = $2 AND subject = $3",
        [sessionId, owner.issuer, owner.subject, title],
      );
    },
    async forget(sessionId, owner) {
      const rows = await query(
        "DELETE FROM web_session_owners WHERE session_id = $1 AND issuer = $2 AND subject = $3 RETURNING session_id",
        [sessionId, owner.issuer, owner.subject],
      );
      return rows.length === 1;
    },
    async list(owner, limit = 30) {
      const rows = await query(
        `SELECT session_id, title, created_at FROM web_session_owners
         WHERE issuer = $1 AND subject = $2
         ORDER BY created_at DESC LIMIT $3`,
        [owner.issuer, owner.subject, limit],
      );
      return rows.map((row) => ({
        sessionId: String(row.session_id),
        title: row.title === null ? null : String(row.title),
        createdAt: new Date(row.created_at as string).toISOString(),
      }));
    },
  };
}

export function createNeonSessionOwnerStore(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return createSqlSessionOwnerStore(
    (text, parameters) =>
      sql.query(text, [...parameters]) as Promise<Record<string, unknown>[]>,
  );
}
