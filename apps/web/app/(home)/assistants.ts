/**
 * Assistants Menta plugs into, each with its official app icon
 * (public/assistants, from the maker's App Store listing) and where Menta is
 * added to it. Muse has no listing to link to yet: it gets the setup prompt.
 */
export const ASSISTANTS = [
  {
    icon: "grokbot",
    name: "Grok Bot",
    href: "https://grok.com/connectors",
  },
  {
    icon: "chatgpt",
    name: "ChatGPT",
    href: "https://chatgpt.com/plugins",
  },
  {
    icon: "claude",
    name: "Claude",
    href: "https://claude.ai/customize/connectors",
  },
  { icon: "muse", name: "Muse", href: null },
] as const;

/**
 * Top-ranked assistants on assistantbenchmark.com, shown on "Any other
 * assistant" (official icons, from each maker's site or App Store listing),
 * Instinct first.
 */
export const OTHER_ASSISTANTS = [
  "instinct",
  "town",
  "pally",
  "ollie",
  "szn",
] as const;

/** A white pill with an assistant's icon, as the homepage's "Add the plugin" step draws them. */
export const assistantButton =
  "inline-flex h-11 items-center gap-2 rounded-full bg-white pr-3 pl-1.5 text-[14px] font-medium whitespace-nowrap text-ink shadow-[0_1px_3px_rgb(0_0_0/4%)] ring-1 ring-black/[0.06] transition-shadow hover:ring-black/10 sm:gap-2.5 sm:text-[15px]";
