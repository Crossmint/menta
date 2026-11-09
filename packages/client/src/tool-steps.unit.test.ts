import type { EveMessagePart } from "eve/react";
import { describe, expect, it } from "vitest";
import {
  describeStep,
  groupSteps,
  hostOf,
  readStep,
  resultCount,
  summarize,
} from "./tool-steps";

type ToolPart = Extract<EveMessagePart, { type: "dynamic-tool" }>;

// Shapes recorded from Eve's web_search (Exa through AI Gateway) and
// web_fetch in a live chat.
function search(
  id: string,
  state: ToolPart["state"],
  extra: Partial<ToolPart> = {},
): ToolPart {
  return {
    type: "dynamic-tool",
    toolName: "web_search",
    toolCallId: id,
    state,
    input: { query: "AirPods Pro 3 price", num_results: 5 },
    inputText: "",
    ...extra,
  } as ToolPart;
}

const searched = search("s1", "output-available", {
  output: {
    requestId: "c609",
    resolvedSearchType: "",
    searchTime: 1139.2,
    costDollars: { total: 0.007 },
    results: [
      {
        id: "https://www.apple.com/shop/buy-airpods/airpods-pro-3",
        title: "Buy AirPods Pro 3 - Apple",
        url: "https://www.apple.com/shop/buy-airpods/airpods-pro-3",
        highlights: ["$249"],
      },
      {
        title: "",
        url: "https://www.bestbuy.com/product/airpods-pro-3/JJGCQLYK5F",
      },
      {
        title: "Duplicate",
        url: "https://www.apple.com/shop/buy-airpods/airpods-pro-3",
      },
      { title: "Not a page", url: "javascript:alert(1)" },
    ],
  },
} as Partial<ToolPart>);

function fetchPart(
  id: string,
  state: ToolPart["state"],
  extra: Partial<ToolPart> = {},
): ToolPart {
  return {
    type: "dynamic-tool",
    toolName: "web_fetch",
    toolCallId: id,
    state,
    input: {
      url: "https://www.samsclub.com/ip/airpods/1",
      format: "markdown",
    },
    inputText: "",
    ...extra,
  } as ToolPart;
}

function stepOf(part: ToolPart, live: boolean) {
  const step = readStep(part, live);
  if (!step) {
    throw new Error(`${part.toolName} is not a research step`);
  }
  return step;
}

describe("hostOf", () => {
  it("drops www and refuses anything but web pages", () => {
    expect(hostOf("https://www.samsclub.com/ip/1")).toBe("samsclub.com");
    expect(hostOf("http://shop.lego.com")).toBe("shop.lego.com");
    expect(hostOf("javascript:alert(1)")).toBeNull();
    expect(hostOf("not a url")).toBeNull();
  });
});

describe("readStep", () => {
  it("reads a search's query and its results, without repeats or odd links", () => {
    const step = stepOf(searched, false);
    expect(step).toMatchObject({ kind: "search", status: "done" });
    expect(describeStep(step)).toEqual({
      verb: "Searched the web",
      detail: "AirPods Pro 3 price",
    });
    expect(step?.kind === "search" && step.results).toEqual([
      {
        title: "Buy AirPods Pro 3 - Apple",
        url: "https://www.apple.com/shop/buy-airpods/airpods-pro-3",
        host: "apple.com",
      },
      {
        title: "bestbuy.com",
        url: "https://www.bestbuy.com/product/airpods-pro-3/JJGCQLYK5F",
        host: "bestbuy.com",
      },
    ]);
    expect(resultCount(step)).toBe("2 results");
  });

  it("shows a query as the model writes it", () => {
    const step = stepOf(
      search("s2", "input-streaming", {
        input: undefined,
        inputText: '{"query":"LEGO Titanic 102',
      } as Partial<ToolPart>),
      true,
    );
    expect(step).toMatchObject({
      status: "running",
      query: "LEGO Titanic 102",
    });
    expect(describeStep(step).verb).toBe("Searching the web");
  });

  it("waits for the whole URL before naming the page", () => {
    const streaming = stepOf(
      fetchPart("f1", "input-streaming", {
        input: undefined,
        inputText: '{"url":"https://www',
      } as Partial<ToolPart>),
      true,
    );
    expect(describeStep(streaming)).toEqual({
      verb: "Reading a page",
      detail: null,
    });
    const reading = stepOf(fetchPart("f1", "input-available"), true);
    expect(describeStep(reading)).toEqual({
      verb: "Reading",
      detail: "samsclub.com",
    });
  });

  it("says when a page couldn't be read or the reply stopped", () => {
    const failed = stepOf(
      fetchPart("f1", "output-error", {
        errorText: "The operation was aborted due to timeout",
      } as Partial<ToolPart>),
      true,
    );
    expect(describeStep(failed).verb).toBe("Couldn't read");
    const stopped = readStep(search("s3", "input-available"), false);
    expect(stopped?.status).toBe("stopped");
  });

  it("leaves checkout tools to their cards", () => {
    expect(
      readStep(
        { ...search("c1", "input-available"), toolName: "checkouts__get" },
        true,
      ),
    ).toBeNull();
  });
});

describe("groupSteps", () => {
  const text = (value: string): EveMessagePart => ({
    type: "text",
    text: value,
  });
  const quiet = (part: EveMessagePart) =>
    part.type === "text" && part.text.trim().length > 0;

  it("puts steps with nothing visible between them in one row", () => {
    const parts: EveMessagePart[] = [
      { type: "step-start" },
      searched,
      { type: "reasoning", text: "comparing" },
      text(" "),
      fetchPart("f1", "output-available", {
        output: { url: "https://www.samsclub.com/ip/airpods/1" },
      } as Partial<ToolPart>),
      text("Sam's Club has it for $199."),
      search("s2", "output-available", {
        output: { results: [] },
      } as Partial<ToolPart>),
    ];
    const runs = groupSteps(parts, false, quiet);
    expect([...runs.keys()]).toEqual([1, 6]);
    expect(runs.get(1)?.map((step) => step.kind)).toEqual(["search", "fetch"]);
    expect(summarize(runs.get(1) ?? [])).toBe("1 search, 1 page");
    expect(summarize(runs.get(6) ?? [])).toBe("1 search");
  });
});
