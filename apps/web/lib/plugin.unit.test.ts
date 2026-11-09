import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { instructions } from "@oca/agent/mcp";
import { describe, expect, it } from "vitest";
import {
  claudeManifest,
  cursorManifest,
  cursorMarketplace,
  openAiManifest,
  PLUGIN_MCP_URL,
  pluginFiles,
} from "./plugin";

const root = resolve(import.meta.dirname, "../../../plugins/menta");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const logo = readFileSync(
  resolve(import.meta.dirname, "../public/brand/icon.png"),
);
const stale = "plugins/menta is stale: run `pnpm plugin:sync`.";

function frontmatter(markdown: string) {
  const block = markdown.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  return Object.fromEntries(
    block.split("\n").map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
  );
}

describe("the Menta plugin package", () => {
  it.each(Object.entries(pluginFiles(instructions, logo)))(
    "keeps %s in sync with its source",
    (path, content) => {
      expect(existsSync(resolve(root, path)), stale).toBe(true);
      if (typeof content !== "string") {
        expect(readFileSync(resolve(root, path)).equals(content), stale).toBe(
          true,
        );
      } else if (path.endsWith(".json")) {
        expect(JSON.parse(read(path)), stale).toEqual(JSON.parse(content));
      } else {
        expect(read(path), stale).toBe(content);
      }
    },
  );

  it("connects to the production MCP server in every format", () => {
    expect(PLUGIN_MCP_URL).toBe("https://menta.crossmint.com/mcp");
    expect(JSON.parse(read("mcp.json")).mcpServers.menta).toEqual({
      type: "streamable-http",
      url: PLUGIN_MCP_URL,
      // OpenAI's ZIP upload requires the auth declared, with both endpoints.
      extensions: {
        "com.openai": {
          auth: {
            type: "oauth",
            client: { mode: "cimd" },
            authorizationUrl: "https://menta.crossmint.com/oauth/authorize",
            tokenUrl: "https://login.menta.crossmint.com/v1/oauth2/token",
            resource: "https://menta.crossmint.com/mcp",
            baseScopes: ["commerce:invoke", "offline_access"],
          },
        },
      },
    });
    expect(JSON.parse(read(".mcp.json")).mcpServers.menta).toEqual({
      type: "http",
      url: PLUGIN_MCP_URL,
    });
  });

  it("is ready for the Cursor Marketplace (and so Grok Bot)", () => {
    const cursor = cursorManifest();
    expect(cursor.name).toBe(openAiManifest().name);
    expect(cursor.name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(cursor.mcpServers.menta).toEqual({ url: PLUGIN_MCP_URL });
    // Relative paths without "./", resolved from the package (and on GitHub, raw).
    for (const path of [cursor.logo, cursor.skills]) {
      expect(path).not.toMatch(/^\.?\//);
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    expect(existsSync(resolve(root, "README.md"))).toBe(true);
    // The repo-root marketplace points at this package.
    const marketplace = resolve(root, "../../.cursor-plugin/marketplace.json");
    expect(JSON.parse(readFileSync(marketplace, "utf8")), stale).toEqual(
      cursorMarketplace(),
    );
    expect(
      existsSync(
        resolve(
          root,
          "../..",
          cursorMarketplace().plugins[0]?.source ?? "",
          ".cursor-plugin/plugin.json",
        ),
      ),
    ).toBe(true);
  });

  it("points every manifest path at a file in the package", () => {
    const openai = openAiManifest().extensions["com.openai"];
    const paths = [
      openai.onboardingSkill,
      openai.interface.composerIcon,
      openai.interface.composerIconDark,
      openai.interface.logo,
    ];
    for (const path of paths) {
      expect(path).toMatch(/^\.\//);
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
    // Submitted packages can't reference a ChatGPT app.
    expect(openai).not.toHaveProperty("apps");
    expect(existsSync(resolve(root, ".app.json"))).toBe(false);
  });

  it("carries what ChatGPT's directory review needs", () => {
    const openai = openAiManifest().extensions["com.openai"];
    const { test_cases } = openai.review;
    expect(test_cases.positive).toHaveLength(5);
    expect(test_cases.negative).toHaveLength(3);
    for (const url of [
      openai.interface.websiteURL,
      openai.interface.supportURL,
      openai.interface.privacyPolicyURL,
      openai.interface.termsOfServiceURL,
    ]) {
      expect(url).toMatch(/^https:\/\//);
    }
    expect(openai.review.commerce).toBe(true);
  });

  it("stays within the directory's listing limits", () => {
    const listing = openAiManifest().extensions["com.openai"].interface;
    expect(listing.displayName.length).toBeLessThanOrEqual(30);
    expect(listing.shortDescription.length).toBeLessThanOrEqual(30);
    expect(listing.longDescription.length).toBeLessThanOrEqual(4000);
    expect(listing.defaultPrompt.length).toBeLessThanOrEqual(3);
    for (const prompt of listing.defaultPrompt) {
      expect(prompt.length).toBeLessThanOrEqual(128);
      expect(prompt).not.toContain("@");
    }
    expect(openAiManifest().name).toMatch(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
    expect(claudeManifest().name).toBe(openAiManifest().name);
  });

  it.each(["setup", "buy"])("names and describes the %s skill", (name) => {
    const skill = read(`skills/${name}/SKILL.md`);
    expect(frontmatter(skill)).toMatchObject({
      name,
      description: expect.stringMatching(/\S{20,}|.{40,}/),
    });
  });

  it("onboards without ever handling a card, code or street in chat", () => {
    const setup = read("skills/setup/SKILL.md");
    expect(setup).toContain("`manage`");
    expect(setup).toContain(
      "You can never approve, create or raise a spending limit",
    );
    expect(setup).toContain(
      "Never ask for card numbers, codes or passwords in chat.",
    );
  });
});
