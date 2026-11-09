import { fitWithin, type Photo } from "@oca/client/photos";

/** The DOM-free half (packages/client). */
export {
  fitWithin,
  MAX_PHOTOS,
  type Photo,
  photoMessage,
  photosOf,
  withoutFileLines,
} from "@oca/client/photos";

/** Re-encode at lower quality when a busy photo is still this large. */
const SOFT_LIMIT = 700_000;

/** What the file picker offers: HEIC is listed so desktop Chrome lets it in. */
export const PHOTO_TYPES = "image/*,.heic,.heif";

function isHeicName(file: File) {
  return /\.(heic|heif)$/i.test(file.name);
}

function encode(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't read that photo.")),
      "image/jpeg",
      quality,
    ),
  );
}

function dataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that photo."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Turn a picked, pasted or dropped image of any size into a small JPEG.
 * Camera photos are often 5 to 15 MB; this makes them a few hundred KB.
 */
/**
 * A fingerprint of the original file's bytes: the same photo picked, pasted
 * or dropped again gets the same key. Pages served over plain http (a phone
 * on the LAN in development) have no crypto.subtle, so fall back to metadata.
 */
export async function photoKey(file: File) {
  if (!crypto.subtle) {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function preparePhoto(file: File, id: string): Promise<Photo> {
  if (!file.type.startsWith("image/") && !isHeicName(file)) {
    throw new Error("Only photos can be added.");
  }
  const bitmap = await decode(file);
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Couldn't read that photo.");
  }
  // JPEG has no transparency; a white page reads better than black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  let blob = await encode(canvas, 0.82);
  if (blob.size > SOFT_LIMIT) {
    blob = await encode(canvas, 0.65);
  }
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return {
    id,
    url: await dataUrl(blob),
    mediaType: "image/jpeg",
    name: `${base}.jpg`,
  };
}

/**
 * Open the photo at full size. iPhones save HEIC, which Safari opens but
 * Chrome and Firefox don't (iOS converts it to JPEG when picked from the
 * camera or library, so this is mostly HEIC files on a computer). Only then
 * load a HEIC decoder; it is large, so the page never loads it otherwise.
 */
async function decode(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fall through to the HEIC decoder.
  }
  const { heicTo, isHeic } = await import("heic-to/next");
  if (!(await isHeic(file).catch(() => false))) {
    throw new Error("This browser can't open that photo. Try a JPEG or PNG.");
  }
  try {
    return await heicTo({ blob: file, type: "bitmap" });
  } catch {
    throw new Error("Couldn't open that HEIC photo. Try a JPEG or PNG.");
  }
}

/** The image files in a pick, paste or drop, if any. */
export function imageFiles(list: FileList | null | undefined) {
  return Array.from(list ?? []).filter(
    (file) => file.type.startsWith("image/") || isHeicName(file),
  );
}
