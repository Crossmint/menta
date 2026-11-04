import { Help } from "../help";
import { helpMetadata } from "../meta";

/** The help page in English. Other languages are at /es/help, /ja/help and so on ([locale]/help). */
export function generateMetadata() {
  return helpMetadata("en");
}

export default function HelpPage() {
  return <Help locale="en" />;
}
