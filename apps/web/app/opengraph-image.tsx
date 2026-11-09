import { loadMessages } from "../lib/i18n/messages";
import { socialImage, storeIcon } from "./_components/social-image";

export const alt =
  "Menta by Crossmint: let your AI agent buy anything, anywhere, at stores like Amazon, DoorDash and Starbucks.";
export { contentType, size } from "./_components/social-image";

/**
 * The social card: the homepage's hero in one frame, its headline with the
 * green words beside a few of the stores. English, from the homepage's own
 * words, so it changes when they do.
 */
export default async function OpenGraphImage() {
  const t = (await loadMessages("en")).landing;
  return socialImage({
    title: t.hero.title.replace("{accent}", t.hero.titleAccent),
    accent: t.hero.titleAccent,
    tiles: await Promise.all(
      ["amazon", "doordash", "starbucks"].map(storeIcon),
    ),
  });
}
