import { describe, expect, it } from "vitest";
import { claudeCodeCommand, codexCommand, setupPrompt } from "./connect";

const url = "https://shop.example.com/mcp";

describe("connect", () => {
  it("builds the CLI commands", () => {
    expect(codexCommand(url)).toBe(
      "codex mcp add menta --url https://shop.example.com/mcp",
    );
    expect(claudeCodeCommand(url)).toBe(
      "claude mcp add --transport http --scope user menta https://shop.example.com/mcp",
    );
  });

  it("writes a setup prompt with the URL, OAuth and both paths", () => {
    const prompt = setupPrompt(url);
    expect(prompt).toContain(`URL: ${url}\n`);
    expect(prompt).toContain("remote HTTP (streamable)");
    expect(prompt).toContain("OAuth in the browser, no API key");
    expect(prompt).toContain(codexCommand(url));
    expect(prompt).toContain(claudeCodeCommand(url));
    expect(prompt).toContain("Stop at the sign-in screen");
    expect(prompt).toContain("walk me through");
    expect(prompt).not.toContain(`${url}/`);
    // Grok Bot also sets up updates, pasting the key on our page.
    expect(prompt).toContain("If you're Grok Bot");
    expect(prompt).toContain("grok_bot_updates_setup");
    expect(prompt).toContain("https://shop.example.com/settings#grok-bot");
  });
});
