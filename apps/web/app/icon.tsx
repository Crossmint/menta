import { ImageResponse } from "next/og";
import { MASCOT_RADIUS, mascot } from "../lib/brand";
import { brandImage } from "../lib/brand-image";

/**
 * App icons from the one logo source (lib/brand.ts): the mascot in a rounded
 * tile, as PNGs for browsers, the manifest and MCP hosts. The URLs (/icon/32,
 * /icon/192, /icon/512) are stable: the manifest, the /favicon.ico rewrite and
 * the MCP server's `icons` point at them, and /icon/svg (the old vector mark)
 * rewrites to /icon/512.
 */
const pngSizes = [32, 192, 512] as const;

export function generateImageMetadata() {
  return pngSizes.map((px) => ({
    id: String(px),
    contentType: "image/png",
    size: { width: px, height: px },
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const key = await id;
  const px = pngSizes.find((size) => String(size) === key) ?? 32;
  return new ImageResponse(
    <div style={{ display: "flex", width: px, height: px }}>
      {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image. */}
      <img
        src={await brandImage(mascot)}
        width={px}
        height={px}
        style={{ borderRadius: px * MASCOT_RADIUS }}
        alt=""
      />
    </div>,
    { width: px, height: px },
  );
}
