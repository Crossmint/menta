import type { EveMessage } from "eve/react";

/**
 * A photo ready to send: a downscaled JPEG as a `data:` URL. `id` is
 * `photoKey` of the original file, so the same photo isn't added twice.
 */
export type Photo = {
  id: string;
  url: string;
  mediaType: string;
  name: string;
};

/**
 * Photos go inline in the message request, which Vercel caps at 4.5 MB.
 * Four photos at the sizes below stay well under that.
 */
export const MAX_PHOTOS = 4;
/** Long edge in pixels: small print (a ticket, a receipt) stays readable. */
export const LONG_EDGE = 1600;

/** The size that fits within `max` on its long edge, never scaling up. */
export function fitWithin(width: number, height: number, max = LONG_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** What `agent.send` takes: plain text, or text plus the photos. */
export function photoMessage(text: string, photos: readonly Photo[]) {
  if (photos.length === 0) {
    return text;
  }
  return [
    ...(text ? [{ type: "text" as const, text }] : []),
    ...photos.map((photo) => ({
      type: "file" as const,
      data: photo.url,
      mediaType: photo.mediaType,
      filename: photo.name,
    })),
  ];
}

/**
 * Until the server confirms a message, Eve's copy of it is text only, with
 * a "[file: name]" line for each photo. Split those lines back out.
 */
export function withoutFileLines(text: string) {
  const lines = text.split("\n");
  const kept = lines.filter((line) => !/^\[file(?:: .*)?\]$/.test(line.trim()));
  return { text: kept.join("\n").trim(), files: lines.length - kept.length };
}

/** The photos a sent message carries, to show them or send them again. */
export function photosOf(message: EveMessage): Photo[] {
  return message.parts.flatMap((part, index) =>
    part.type === "file" && part.url && part.mediaType.startsWith("image/")
      ? [
          {
            id: `${message.id}-${index}`,
            url: part.url,
            mediaType: part.mediaType,
            name: part.filename ?? "photo.jpg",
          },
        ]
      : [],
  );
}
