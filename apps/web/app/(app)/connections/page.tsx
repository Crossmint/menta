import { permanentRedirect } from "next/navigation";

/** Connected agents live in Settings, as Agents. */
export default function ConnectionsPage() {
  permanentRedirect("/settings/agents");
}
