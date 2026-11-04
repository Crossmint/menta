import OpenGraphImage from "./opengraph-image";

export { alt, size } from "./opengraph-image";
export const contentType = "image/png";

/** The same image as Open Graph (summary_large_image). */
export default function TwitterImage() {
  return OpenGraphImage();
}
