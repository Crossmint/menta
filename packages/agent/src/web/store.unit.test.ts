import type { SessionAuthContext } from "eve/context";
import { describe, expect, it, vi } from "vitest";
import { createSqlSessionOwnerStore } from "./store.js";

const owner: SessionAuthContext = {
  authenticator: "stytch",
  principalType: "user",
  principalId: "user-test-1",
  issuer: "stytch.com/project-test",
  subject: "user-test-1",
  attributes: {},
};

describe("SessionOwnerStore.forget", () => {
  it("deletes only the row this owner holds and reports it", async () => {
    const query = vi.fn().mockResolvedValue([{ session_id: "wrun_A" }]);
    const store = createSqlSessionOwnerStore(query);
    expect(await store.forget("wrun_A", owner)).toBe(true);
    const [text, parameters] = query.mock.calls[0] ?? [];
    expect(text).toMatch(
      /^DELETE FROM web_session_owners WHERE session_id = \$1 AND issuer = \$2 AND subject = \$3 RETURNING/,
    );
    expect(parameters).toEqual([
      "wrun_A",
      "stytch.com/project-test",
      "user-test-1",
    ]);
  });

  it("reports false when the owner has no such conversation", async () => {
    const store = createSqlSessionOwnerStore(vi.fn().mockResolvedValue([]));
    expect(await store.forget("wrun_someone_elses", owner)).toBe(false);
  });
});
