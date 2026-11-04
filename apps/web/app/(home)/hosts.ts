import type { CSSProperties } from "react";

/**
 * The assistants the hero demo plays in, each drawn after its own desktop app.
 * The window's chrome reads these variables, so switching hosts morphs the
 * colors and shapes; the words are in the messages (`landing.demo.host`).
 */
export type Host = "chatgpt" | "claude" | "grok";

export const HOSTS: Record<
  Host,
  {
    name: string;
    model: string | null;
    /** Its app icon in public/assistants. */
    icon: string;
    vars: CSSProperties;
  }
> = {
  chatgpt: {
    name: "ChatGPT",
    model: "GPT-6.1",
    icon: "chatgpt",
    vars: {
      "--host-bg": "#ffffff",
      "--host-side": "#f9f9f9",
      "--host-line": "#ececec",
      "--host-active": "#ececec",
      "--host-ink": "#0d0d0d",
      "--host-soft": "#8f8f8f",
      "--host-composer": "#ffffff",
      "--host-composer-radius": "28px",
    } as CSSProperties,
  },
  claude: {
    name: "Claude",
    model: "Sonnet 5.5",
    icon: "claude",
    vars: {
      "--host-bg": "#faf9f5",
      "--host-side": "#f5f4ef",
      "--host-line": "#e8e6dc",
      "--host-active": "#ebe9e1",
      "--host-ink": "#141413",
      "--host-soft": "#87867f",
      "--host-composer": "#ffffff",
      "--host-composer-radius": "20px",
    } as CSSProperties,
  },
  grok: {
    name: "Grok Bot",
    model: null,
    icon: "grokbot",
    vars: {
      "--host-bg": "#ffffff",
      "--host-side": "#f5f5f5",
      "--host-line": "#e9e9e9",
      "--host-active": "#e8e8e8",
      "--host-ink": "#111111",
      "--host-soft": "#8a8a8a",
      "--host-composer": "#ffffff",
      "--host-composer-radius": "999px",
    } as CSSProperties,
  },
};
