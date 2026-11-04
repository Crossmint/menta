# Directory submissions

What to enter in each assistant directory for Menta, so the listings say the same thing everywhere. Menta is published by Crossmint, never a personal account. How to submit is in `plugins/menta/README.md` ("Submit to the directories"); this is the text and the answers.

| Directory | Submit as | Permission the submitter needs | Status |
| --- | --- | --- | --- |
| ChatGPT (platform.openai.com/plugins) | Crossmint org, preverified for app submission | Apps Management Write (from an org owner) | not submitted |
| Claude connector and plugin (claude.ai/directory/manage) | Crossmint org (Enterprise) | Directory (Organization settings → Roles) | not submitted |
| Cursor Marketplace (Grok Bot) | Crossmint | a public repository | waiting for the public repo |

## Shared

- **Name:** Menta
- **Developer / company:** Crossmint, https://www.crossmint.com
- **Website:** https://menta.crossmint.com
- **Docs:** https://menta.crossmint.com/help
- **Privacy policy:** https://menta.crossmint.com/privacy
- **Terms:** https://menta.crossmint.com/terms
- **Support:** https://menta.crossmint.com/help#contact (agents@crossmint.com, or @crossmint_ai on X)
- **Icon:** `apps/web/public/brand/icon.png` (also `plugins/menta/assets/logo.png`)
- **MCP server:** `https://menta.crossmint.com/mcp`, Streamable HTTP, OAuth 2.0 (Stytch; dynamic client registration and CIMD, no client to enter)
- **Category:** Shopping on Claude; Productivity on ChatGPT, which has no Shopping category

**Reviewer account.** A Menta account with a saved delivery address and a card with a very low limit (or one that declines), and no spending limits, so a reviewer reaches the spending-limit step and can cancel without paying. (With a limit that covers the total, the assistant would pay from it.) Before each review, revoke any spending limit left on it in Spending limits. Sign-in must work without an emailed code: OpenAI rejects accounts behind MFA. Enter the credentials only in each dashboard's private reviewer fields, never in the repository.

**Demo video (ChatGPT).** One take in ChatGPT: "Buy a 4-pack of AA batteries on Amazon, under $15" → a store question answered in the card → the payment step asking to approve the total as a spending limit (the account has none yet) → Cancel.

## ChatGPT

The package (`menta-chatgpt.zip`, see the README) carries the listing, the five positive and three negative review cases, the commerce declaration and the release notes, from `apps/web/lib/plugin.ts`. The dashboard also asks for:

**Iframe justification.** The checkout card embeds:

- `https://www.crossmint.com`: Crossmint's protected inputs for store sign-ins (passwords and codes). Controlled by Crossmint, Menta's publisher. This is how the user enters them without them passing through the chat; the model can't reach them.
- `https://*.basistheory.com`: the frames Crossmint's protected inputs are built on, which hold what the user types. Controlled by Basis Theory, Crossmint's vault provider.

A payment never runs in the card: it links to `https://menta.crossmint.com/spending-limit/{token}`, Menta's own page, where the user approves a spending limit. If the host doesn't allow the protected-input frames, the card links to `https://menta.crossmint.com/checkouts/{id}` to enter them there.

**Commerce.** Physical goods and orders from online stores, paid by the user's own card through Crossmint. Menta pays only within spending limits the user approves, on Menta's domain or in Menta's card; the model can never approve, create or raise one. No ChatGPT-specific fee.

## Claude connector

**One-liner** (200 max):
> Buy things online at stores worldwide. Menta fills the cart and checkout; you answer the store's questions, and it pays only within spending limits you approve.

**Description** (2,000 max):
> Menta buys things online for you. Tell Claude what you want and where, and Menta starts a checkout with Crossmint: a browser agent fills the store's cart and checkout and never spends above the price limit you set. The checkout card shows only when you're needed (the store's questions, private details, a spending limit) and for the receipt; you answer in the card or in chat.
>
> When the store is ready to charge, Menta pays from a spending limit you approved, if one covers the total; otherwise you approve one yourself in Crossmint's secure form, with a card saved on your Menta account. Claude can never approve or raise a spending limit, and card numbers, codes and passwords never pass through the chat. Ask Claude where an order is, or to cancel a checkout, any time.
>
> Menta works at stores worldwide. Some stores block automated browsers.

**Categories:** Shopping (plus Productivity if a second is wanted).

**Use cases:** buy household items, groceries and other physical goods at a named store under a price limit; order food for pickup or delivery; check an order's status and receipt; cancel a checkout.

**What users need first:** a Menta account (sign in when connecting) and a card saved on it in Crossmint's secure form. A saved delivery address is optional.

**Reads or writes:** both. It reads checkouts and saved address labels, and starts, answers, steers and cancels checkouts.

**Authentication:** required. OAuth 2.0; leave the Anthropic-held client empty (Claude registers itself).

**Data handling:** our own API (Crossmint publishes Menta and runs Agent Checkouts). No health data, no sponsored content.

**Allowed link URIs:** `https://menta.crossmint.com`

**Test & launch:** connect with the reviewer account, then try: "Buy a 4-pack of AA batteries on Amazon, under $15" (the card shows when the store needs you; at payment, cancel instead of approving a spending limit), "Where is my last order?", "Cancel my Amazon checkout", "Set up Menta". Every tool was run as a custom connector in Claude.

**Compliance notes**, for the acknowledgments:

- *Financial transactions:* every payment comes from a spending limit the user approved in Crossmint's form, outside the model's reach (human in the loop for each limit). A limit has an amount, an expiry and optionally a store, the card networks enforce it, and the user can revoke it any time. At payment the assistant picks which of the user's approved limits pays, and Menta pays only after checking that limit is the user's and covers the payment; the model can never approve, create or raise one.
- *Conversation data:* Menta keeps no transcripts and no notes from the assistant's conversations; it reads checkouts and saved addresses from Crossmint when a tool is called.
- *Prompt injection:* store pages are untrusted input to the browser agent; it can't raise the checkout's price limit, and spending limits are approved only in Crossmint's form.

**Carousel screenshots** (3–5 PNG, at least 1000 px wide, cropped to the card, each with its prompt):

1. "Order a Harvest Bowl from Sweetgreen for pickup at 12:30." — a store question in the step card
2. The payment step: approving the total as a spending limit with the saved card
3. "Where is my last order?" — the outcome with the receipt total and order number

## Claude plugin

Repository `Crossmint/menta`, plugin path `plugins/menta`, tracking `main`. Data handling: it reads and stores personal data only through the Menta connector (no other destinations), keeps nothing itself, and isn't intended for people under 18. It goes live once the repository is public.
