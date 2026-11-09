import type { Channel } from "eve/channels";
import {
  createUnauthorizedResponse,
  UnauthenticatedError,
} from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import type { SessionAuthContext } from "eve/context";
import type { SessionOwnerStore } from "./store.js";

function sameUser(a: SessionAuthContext, b: SessionAuthContext) {
  return a.issuer === b.issuer && a.subject === b.subject;
}

/** First line of the user's message, used as the conversation title. */
async function titleOf(request: Request) {
  try {
    const body = (await request.clone().json()) as { message?: unknown };
    const text =
      typeof body.message === "string"
        ? body.message
        : Array.isArray(body.message)
          ? body.message
              .map((part: { type?: string; text?: string }) =>
                part?.type === "text" ? part.text : "",
              )
              .join(" ")
          : "";
    const line = text.trim().split("\n")[0]?.trim() ?? "";
    return line ? line.slice(0, 80) : null;
  } catch {
    return null;
  }
}

/**
 * Eve's own web routes, limited to the signed-in owner of each session.
 * Creating a session binds it to the caller; every session route checks that binding.
 */
export function createOwnedEveChannel(options: {
  authenticateRequest(request: Request): Promise<SessionAuthContext>;
  owners: SessionOwnerStore;
}): Channel {
  const authenticated = new WeakMap<Request, SessionAuthContext>();
  const base = eveChannel({
    auth: async (request) => {
      const current = authenticated.get(request);
      if (!current) {
        throw new UnauthenticatedError({ message: "Sign in to chat" });
      }
      return current;
    },
  });
  return {
    ...base,
    routes: base.routes.map((route) => {
      const create =
        route.path === "/eve/v1/session" && route.method === "POST";
      const message =
        route.path === "/eve/v1/session/:sessionId" && route.method === "POST";
      const sessionRoute = route.path.startsWith("/eve/v1/session/");
      const info = route.path === "/eve/v1/info";
      if (
        route.transport === "websocket" ||
        !(create || sessionRoute || info)
      ) {
        return route;
      }
      return {
        ...route,
        async handler(request, args) {
          let current: SessionAuthContext;
          try {
            current = await options.authenticateRequest(request);
          } catch {
            return createUnauthorizedResponse({
              status: 401,
              message: "Sign in to chat",
            });
          }
          const sessionId =
            args.params.parentSessionId ?? args.params.sessionId;
          if (sessionRoute) {
            const owner = sessionId
              ? await options.owners.get(sessionId)
              : null;
            if (!owner || !sameUser(owner, current)) {
              return createUnauthorizedResponse({
                status: 403,
                message: "This conversation belongs to another account",
              });
            }
          }
          const title = create || message ? await titleOf(request) : null;
          authenticated.set(request, current);
          try {
            const response = await route.handler(request, args);
            // Local `eve dev` parks runs from before a restart and answers their
            // messages with a generic 500. Report it as an ended conversation.
            if (
              message &&
              response.status >= 500 &&
              process.env.NODE_ENV !== "production"
            ) {
              return Response.json(
                {
                  ok: false,
                  code: "session_not_active",
                  error: "The session is no longer active.",
                },
                { status: 409 },
              );
            }
            if (create && response.status === 202) {
              const { sessionId: created } = (await response
                .clone()
                .json()) as {
                sessionId: string;
              };
              await options.owners.bind(created, current, title);
            } else if (message && sessionId && title && response.ok) {
              await options.owners.bind(sessionId, current, title);
            }
            return response;
          } finally {
            authenticated.delete(request);
          }
        },
      };
    }),
  };
}
