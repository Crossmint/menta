import { describe, expect, it } from "vitest";
import { shortTask } from "./task.js";

describe("shortTask", () => {
  it("turns links into their bare domain", () => {
    expect(
      shortTask(
        "Buy one Chewed To Death Cat Toy from https://liquiddeath.com/products/chewed-to-death-cat-toy?variant=123",
      ),
    ).toBe("Buy one Chewed To Death Cat Toy from liquiddeath.com");
    expect(shortTask("Get it at https://www.amazon.com/dp/B0ABC")).toBe(
      "Get it at amazon.com",
    );
    expect(shortTask("see www.target.com/p/thing for details")).toBe(
      "see target.com for details",
    );
  });

  it("keeps punctuation that ends the sentence", () => {
    expect(shortTask("Buy it (https://shop.example.com/a/b), size M.")).toBe(
      "Buy it (shop.example.com), size M.",
    );
    expect(shortTask("From http://example.org/x.")).toBe("From example.org.");
  });

  it("collapses whitespace", () => {
    expect(shortTask("  Buy\n\n two   socks\t ")).toBe("Buy two socks");
  });

  it("leaves text without links alone", () => {
    expect(shortTask("Buy the blue one, size 10")).toBe(
      "Buy the blue one, size 10",
    );
    expect(shortTask("")).toBe("");
  });
});
