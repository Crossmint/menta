import { defineMemory } from "eve/memory";
import { MEMORY_INSTRUCTIONS } from "../src/memory.js";
import { commerceMemory, memoryScope } from "../src/memory-provider.js";

export default defineMemory({
  // The product's old name, kept: renaming the namespace would hide everyone's saved memory.
  namespace: "open-commerce-memory-v1",
  description: MEMORY_INSTRUCTIONS,
  scope: memoryScope,
  provider: commerceMemory(),
});
