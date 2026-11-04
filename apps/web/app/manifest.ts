import type { MetadataRoute } from "next";
import { BRAND_NAME, colors } from "../lib/brand";
import { DESCRIPTION } from "../lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} by Crossmint`,
    short_name: BRAND_NAME,
    description: DESCRIPTION,
    start_url: "/home",
    display: "standalone",
    background_color: colors.white,
    theme_color: colors.white,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
