import { notFound, permanentRedirect } from "next/navigation";
import { movedTo } from "../sections";

/**
 * Older section URLs land on the page that took them over
 * (`/settings/payments` → Delivery addresses). The redirect names no
 * fragment, so the browser keeps the link's own.
 */
export default async function SettingsSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const moved = movedTo((await params).section);
  if (!moved) {
    notFound();
  }
  permanentRedirect(moved);
}
