import { describe, expect, it } from "vitest";
import { setupPrompt } from "./connect";

describe("connect", () => {
  it("writes a one-line setup prompt with the URL", () => {
    expect(setupPrompt("https://shop.example.com/mcp")).toBe(
      "Install this MCP server so you can buy things for me: https://shop.example.com/mcp",
    );
  });
});
