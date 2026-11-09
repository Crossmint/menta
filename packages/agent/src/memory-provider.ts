import {
  defineMemoryProvider,
  type MemoryOperationContext,
  type MemoryScopeContext,
} from "eve/memory";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { crossmintUserId } from "./crossmint.js";
import {
  getMemoryStore,
  type MemoryStore,
  memoryContext,
  memoryId,
  memoryText,
} from "./memory.js";

/** No shared local-dev fallback: every memory belongs to a verified Stytch user. */
export function memoryScope(ctx: MemoryScopeContext) {
  const auth = ctx.session.auth.current;
  return auth?.principalType === "user" ? crossmintUserId(auth) : null;
}

/** Eve locks the verified user scope for recall, compaction and tool replay. */
function userOf(ctx: {
  memory: { scope: { value: string | readonly string[] } };
}) {
  const userId = ctx.memory.scope.value;
  if (typeof userId !== "string" || !userId) {
    throw new Error("Memory requires an authenticated user scope");
  }
  return userId;
}

export function commerceMemory(store: () => MemoryStore = getMemoryStore) {
  async function recall(ctx: MemoryOperationContext) {
    return {
      messages: [
        {
          id: "user-memory",
          content: memoryContext(await store().read(userOf(ctx))),
        },
      ],
    };
  }
  return defineMemoryProvider({
    recall: { "turn.started": recall, "compaction.completed": recall },
    async tools(ctx) {
      const userId = userOf(ctx);
      return {
        save_memory: defineTool({
          description:
            "Save a concise note that will help in future conversations. You decide what to remember. Never save secrets, protected inputs or payment authorization. Remove outdated notes before saving corrections.",
          inputSchema: z.strictObject({ text: memoryText }),
          execute: async ({ text }) => store().save(userId, text),
        }),
        remove_memory: defineTool({
          description:
            "Forget a note by its ID in recalled memory when outdated, incorrect, or the user asks you to forget it.",
          inputSchema: z.strictObject({ id: memoryId }),
          async execute({ id }) {
            await store().remove(userId, id);
            return { removed: true };
          },
        }),
      };
    },
  });
}
