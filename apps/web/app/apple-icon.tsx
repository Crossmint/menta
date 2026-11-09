import { ImageResponse } from "next/og";
import { mascot } from "../lib/brand";
import { brandImage } from "../lib/brand-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The mascot, full-bleed: iOS rounds the corners itself. */
export default async function AppleIcon() {
  return new ImageResponse(
    <div style={{ display: "flex", width: 180, height: 180 }}>
      {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image. */}
      <img src={await brandImage(mascot)} width={180} height={180} alt="" />
    </div>,
    size,
  );
}
