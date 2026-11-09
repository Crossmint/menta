import { permanentRedirect } from "next/navigation";

/**
 * Install became the connect step on Home (and Settings, Agents).
 * Sign-in, the homepage and assistants still link here.
 */
export default function InstallPage() {
  permanentRedirect("/home");
}
