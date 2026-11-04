/**
 * The Menta brand, in one place. The logo is the leaf in a dark rounded tile
 * with the "menta" wordmark beside it (`Logo` in app/_components/icons.tsx);
 * the tile alone is the icon. public/brand/menta-logo.webp is the lockup both
 * are cut from. Both are images in public/brand: the favicon, app
 * and Apple icons, manifest, social images, the plugin's icons and the MCP
 * server's icons (which link to the icon routes) all draw from them, so
 * changing the logo is a change to those two files.
 */

export const BRAND_NAME = "Menta";

export const colors = {
  ink: "#0a0a0a",
  accent: "#087f41",
  white: "#ffffff",
  /** The homepage hero's soft grey (app/style.css `--color-stage`). */
  stage: "#f7f7f6",
} as const;

/** The icon (still `mascot` in code): the leaf tile, square and full-bleed. Shown on its own, its corners are rounded. */
export const mascot = {
  src: "/brand/icon.png",
  width: 512,
  height: 512,
} as const;

/** The "menta" wordmark in ink, trimmed to the letters, on transparent. */
export const wordmark = {
  src: "/brand/wordmark.png",
  width: 536,
  height: 114,
} as const;

/** The mascot tile's corner radius, as a fraction of its side. */
export const MASCOT_RADIUS = 0.22;

/** In the lockup, the wordmark's height and the gap before it, as fractions of the tile's side. */
export const WORDMARK_SCALE = 0.94;
export const WORDMARK_GAP = 0.19;
