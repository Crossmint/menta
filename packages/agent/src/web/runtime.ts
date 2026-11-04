import { Client } from "stytch";
import {
  createStytchWebAuthenticator,
  readWebSessionToken,
} from "../auth/index.js";
import { requireEnv, webOrigin } from "../env.js";
import { createOwnedEveChannel } from "./channel.js";
import {
  createNeonSessionOwnerStore,
  type SessionOwnerStore,
} from "./store.js";

let owners: SessionOwnerStore | undefined;
export function getSessionOwners() {
  owners ??= createNeonSessionOwnerStore(requireEnv("DATABASE_URL"));
  return owners;
}

let authenticator: ReturnType<typeof createStytchWebAuthenticator> | undefined;
/** Verifies the request's Stytch session from the web's HttpOnly cookie. */
export function authenticateWebRequest(request: Request) {
  authenticator ??= createStytchWebAuthenticator({
    projectId: requireEnv("STYTCH_PROJECT_ID"),
    client: new Client({
      project_id: requireEnv("STYTCH_PROJECT_ID"),
      secret: requireEnv("STYTCH_SECRET"),
      timeout: 10000,
    }),
  });
  const token = readWebSessionToken(request, webOrigin());
  if (!token) {
    return Promise.reject(new Error("Not signed in"));
  }
  return authenticator.authenticateWebSession(token);
}

export function createWebChannel() {
  return createOwnedEveChannel({
    authenticateRequest: authenticateWebRequest,
    owners: {
      get: (id) => getSessionOwners().get(id),
      bind: (id, owner, title) => getSessionOwners().bind(id, owner, title),
      list: (owner, limit) => getSessionOwners().list(owner, limit),
      forget: (id, owner) => getSessionOwners().forget(id, owner),
      rename: (id, owner, title) => getSessionOwners().rename(id, owner, title),
    },
  });
}
