/**
 * The public help page (/help), the documentation the assistant directories
 * link to. The per-app install steps, link names and example come from `app`.
 */
export default {
  meta: {
    title: "Help",
    description:
      "How to add Menta to your assistant, how a purchase works, and where your cards, addresses and orders are.",
  },
  title: "Menta help",
  lede: "Menta is a plugin for ChatGPT, Claude, Grok Bot and other assistants. Tell your assistant what to buy, and Menta checks out for you at online stores worldwide, through Crossmint Agent Checkouts.",
  install: {
    title: "Add Menta to your assistant",
    lede: "Pick your assistant. When it asks, sign in to Menta and allow access.",
    server: "Server URL",
    listed:
      "Once Menta is listed in {directory}, add it from there. Until then, add it yourself:",
    chatgptDirectory: "ChatGPT's plugin directory",
    claudeDirectory: "Claude's connector directory",
    grokBot:
      "Once Menta is in Grok Bot's Marketplace, open the Marketplace, add Menta and sign in.",
    signIn: "sign in to Menta and allow access.",
    otherApp: "Other app",
    example:
      "Buy a 4-pack of AA batteries on Amazon, under $15, delivered home.",
    apps: {
      chatgpt: [
        "Open {plugins} and choose {add}. Not there? Turn on Developer mode in Settings first.",
        "Name it Menta, paste the URL and pick {oauth}.",
        "Choose {create}, then {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Open {connectors} and choose {add}.",
        "Name it Menta and paste the URL exactly, with no trailing slash.",
        "Keep the sign-in Claude detects, choose {confirm}, then {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Find where your app adds MCP servers or connectors (often called custom connectors or integrations).",
        "Add a remote HTTP server with the URL above. Sign-in is OAuth, so leave any API key field empty.",
        "When asked, {signIn}",
      ],
    },
  },
  purchase: {
    title: "How a purchase works",
    steps: [
      {
        title: "Say what to buy",
        text: "Tell your assistant what you want and where, like “{example}”",
      },
      {
        title: "Menta checks out",
        text: "Menta starts a checkout at the store and shows you its progress.",
      },
      {
        title: "Answer the store",
        text: "If the store needs something from you, like a size or a delivery time, your assistant asks and you answer.",
      },
      {
        title: "Approve a spending limit",
        text: "When the store is ready to charge, Menta pays from a spending limit you approved, if one covers it. If none does, you approve one yourself in Crossmint's secure form, in your assistant or on a Menta page. Nothing is paid beyond your limits.",
      },
    ],
    never:
      "Your assistant can never approve or raise a spending limit. Card numbers, verification codes and passwords never go through the chat: when one is needed, you type it into Crossmint's secure form.",
  },
  saved: {
    title: "Cards and addresses",
    cards:
      "Your cards are saved on your Menta account by Crossmint. Add and manage them in {wallet}. Your assistant sees only a card's brand and last 4 digits.",
    addresses:
      "Your delivery addresses are saved in {addresses}. Your assistant reads them only as needed: your default address's label and city to say where deliveries go, and the rest when you or a store ask for it.",
    signIn: "Both pages ask you to sign in to Menta.",
  },
  orders: {
    title: "Checking or cancelling an order",
    text: "Ask your assistant how a checkout is going, or ask it to cancel one. Everything Menta has bought for you, from any assistant, is in {transactions}.",
    store:
      "Orders are in your name at the store, so after an order is placed, changes and returns go through the store.",
  },
  limits: {
    title: "What Menta can't do",
    items: [
      "Some stores block automated browsers, so Menta can't check out at them.",
      "Menta buys physical goods and places orders at online stores, delivered to you or ready for pickup.",
      "Menta pays only with a card you've saved, and only within a spending limit you approved.",
    ],
  },
  contact: {
    title: "Privacy, terms and support",
    text: "Menta is made by Crossmint. For help, email {email} or tag {x} on X.",
  },
  legal: {
    terms: "Terms of service",
    privacy: "Privacy policy",
    englishOnly: "This document is available in English only.",
    agree: "By continuing, you agree to Menta's {terms} and {privacy}.",
    agreeTerms: "terms of service",
    agreePrivacy: "privacy policy",
  },
};
