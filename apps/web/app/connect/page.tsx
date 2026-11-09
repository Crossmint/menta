import { permanentRedirect } from "next/navigation";

/** The install guide moved into the app, where it can show your setup. */
export default function Connect() {
  permanentRedirect("/install");
}
