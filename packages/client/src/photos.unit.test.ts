import type { EveMessage } from "eve/react";
import { describe, expect, it } from "vitest";
import { fitWithin, photoMessage, photosOf, withoutFileLines } from "./photos";

const photo = {
  id: "1",
  url: "data:image/jpeg;base64,AAAA",
  mediaType: "image/jpeg",
  name: "ticket.jpg",
};

describe("fitWithin", () => {
  it("scales a big camera photo down to the long edge", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never scales a small image up", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("photoMessage", () => {
  it("stays plain text without photos", () => {
    expect(photoMessage("Pay these", [])).toBe("Pay these");
  });

  it("puts the text first, then each photo as a file part", () => {
    expect(photoMessage("Pay these", [photo])).toEqual([
      { type: "text", text: "Pay these" },
      {
        type: "file",
        data: photo.url,
        mediaType: "image/jpeg",
        filename: "ticket.jpg",
      },
    ]);
  });

  it("sends photos alone when there is no text", () => {
    expect(photoMessage("", [photo])).toHaveLength(1);
  });
});

describe("photosOf", () => {
  it("reads image parts back from a sent message", () => {
    const message = {
      id: "m1",
      role: "user",
      parts: [
        { type: "text", text: "Pay these" },
        { type: "file", mediaType: "image/jpeg", url: photo.url },
        { type: "file", mediaType: "application/pdf", url: "data:x" },
        { type: "file", mediaType: "image/png" },
      ],
    } as unknown as EveMessage;
    expect(photosOf(message)).toEqual([
      {
        id: "m1-1",
        url: photo.url,
        mediaType: "image/jpeg",
        name: "photo.jpg",
      },
    ]);
  });
});

describe("withoutFileLines", () => {
  it("splits Eve's photo placeholders out of an unconfirmed message", () => {
    expect(withoutFileLines("Pay these\n[file: IMG_1.jpg]\n[file]")).toEqual({
      text: "Pay these",
      files: 2,
    });
    expect(withoutFileLines("[file: Screenshot at 1.18.24 PM.jpg]")).toEqual({
      text: "",
      files: 1,
    });
  });
});
