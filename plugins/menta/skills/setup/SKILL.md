---
name: setup
description: Set up Menta right after it's installed, or when the user asks what it does or how to get started. Welcomes them with what Menta can do and why it's safe, asks what they want to buy today, points them to their card and address when a checkout needs them, and in Grok Bot offers Menta updates.
---

# Set up Menta

Menta lets you buy anything, anywhere, for the user, from this chat: you start a checkout, a Crossmint browser agent works through the store, and Menta pays only from spending limits the user approved. Keep every message short and friendly, and let them skip anything.

1. **Welcome.** One message, three or four short sentences, in the user's language:
   - What it does, with a few examples that fit the user (from this conversation, where they are, the season): big carts like a recipe's ingredients or the weekly groceries, food for a group, researching what a project needs and buying it all, a bill paid from a photo of it, a table, tickets or a hotel, changing a subscription. At any store worldwide, signed in to their own accounts (their Amazon account, with its addresses and saved cards), paying with whatever the store takes.
   - Why it's safe: it's built by Crossmint. Their card stays in Crossmint's secure vault and you never see it. Menta pays only within spending limits they approve, which Visa and Mastercard enforce. Orders are in their name, so returns and refunds work as usual, and they keep their card's points.
   - End with one question: what do they want to buy or get done today? Offer two or three ideas from what you know about them, e.g. "the groceries for this week?" or "the concert tickets you mentioned?". With nothing to go on, use one from the list above.

   If Menta was installed in the middle of a task, skip the welcome and go back to that task.

2. **Card and address, when needed.** Don't front-load setup: bring it up when their first checkout needs it, or if they ask. The first payment needs a saved card: call `manage` and give them the card link exactly as returned (they add it in Crossmint's secure form). For deliveries, offer to save their address: they can just tell you their name, phone and street, and you save it with `save_delivery_address` as their default. Never ask for card numbers, codes or passwords in chat. You can never approve, create or raise a spending limit: only the user does, in Crossmint's secure form.

3. **Updates (Grok Bot only).** Skip this step on every other host, and when you don't have `grok_bot_updates_setup`. Offer once: "Want me to let you know here when a checkout needs you, even after this chat?" If they say yes (or "Turn on Menta updates"), call `grok_bot_updates_setup` and follow its `next` line: if updates are already on, say so; otherwise create the routine with its exact instruction, add a webhook trigger to it, then tell them to open the routine's panel and paste its Webhook URL and Webhook key (or the Authorization header) at the link it gives, and press Save. You can't see the URL or key; never ask for them in chat.

Never say a card or address is saved unless the user says so.
