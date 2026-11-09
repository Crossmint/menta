import type { TranscriptionStreamPart } from "ai";
import { describe, expect, it } from "vitest";
import {
  emptyTranscript,
  meterLevel,
  nextTranscript,
  spliceDictation,
  transcriptText,
} from "./dictation";

function play(parts: TranscriptionStreamPart[]) {
  const seen: string[] = [];
  let transcript = emptyTranscript;
  for (const part of parts) {
    transcript = nextTranscript(transcript, part);
    seen.push(transcriptText(transcript));
  }
  return seen;
}

describe("transcript", () => {
  it("shows committed words plus the live guess after them", () => {
    // The shape MAI-Transcribe-2-Streaming sends through the Gateway.
    expect(
      play([
        { type: "transcript-partial", text: "Order 2." },
        { type: "transcript-partial", text: "Order two packs of Duracell AA" },
        { type: "transcript-delta", delta: "Order" },
        {
          type: "transcript-partial",
          text: " two packs of Duracell AA batteries.",
        },
        { type: "transcript-delta", delta: " two packs of" },
        { type: "transcript-partial", text: " Duracell AA batteries." },
        { type: "transcript-delta", delta: " Duracell AA batteries." },
        {
          type: "transcript-final",
          text: "Order two packs of Duracell AA batteries.",
        },
      ]),
    ).toEqual([
      "Order 2.",
      "Order two packs of Duracell AA",
      "Order",
      "Order two packs of Duracell AA batteries.",
      "Order two packs of",
      "Order two packs of Duracell AA batteries.",
      "Order two packs of Duracell AA batteries.",
      "Order two packs of Duracell AA batteries.",
    ]);
  });

  it("keeps finished segments and starts the next one", () => {
    const [, , last] = play([
      { type: "transcript-final", text: "Under $349." },
      { type: "transcript-delta", delta: " Ship to" },
      { type: "transcript-partial", text: " 94043" },
    ]);
    expect(last).toBe("Under $349. Ship to 94043");
  });

  it("ignores parts without text", () => {
    expect(nextTranscript(emptyTranscript, { type: "raw", rawValue: {} })).toBe(
      emptyTranscript,
    );
  });
});

describe("spliceDictation", () => {
  it("inserts at the caret, spaced like typing", () => {
    expect(spliceDictation("", "Find headphones", "")).toBe("Find headphones");
    expect(spliceDictation("Buy", "two of them", "")).toBe("Buy two of them");
    expect(spliceDictation("Buy ", "two", " today")).toBe("Buy two today");
    expect(spliceDictation("Buy", "two", "today")).toBe("Buy two today");
  });

  it("leaves the text alone when nothing was heard", () => {
    expect(spliceDictation("Buy", "", " it")).toBe("Buy it");
  });
});

describe("meterLevel", () => {
  it("maps loudness to 0..1", () => {
    expect(meterLevel(0)).toBe(0);
    expect(meterLevel(0.0005)).toBe(0);
    expect(meterLevel(0.05)).toBeGreaterThan(0.5);
    expect(meterLevel(1)).toBe(1);
  });
});
