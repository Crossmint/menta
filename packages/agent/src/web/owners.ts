import { requireEnv } from "../env.js";
import {
  createNeonSessionOwnerStore,
  type SessionOwnerStore,
} from "./store.js";

let owners: SessionOwnerStore | undefined;
/** The Neon-backed owner store, shared by the Eve channel and the web app. */
export function getSessionOwners() {
  owners ??= createNeonSessionOwnerStore(requireEnv("DATABASE_URL"));
  return owners;
}
