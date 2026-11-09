# Addresses

How saved addresses (Crossmint buyer profiles) work in checkouts. The code is `planShipping` in `packages/crossmint-agent-checkouts/extension/lib/checkouts.ts`; its tests follow the table below row by row.

**Principle: an address is help, not a gate.** A checkout stops to ask only when it truly can't go on without one: a delivery to someone else whose address nobody has.

## Concepts

- **Saved address**: a Crossmint buyer profile. A label ("Home", "Mom"), name, email, phone and a required shipping address. A user can have any number.
- **Default**: the one profile ID we keep per user in Neon (`default_addresses`). It is the user's own place, or there is none. Only the user sets it: on Menta, or by asking their assistant.
- **Store account**: the user's single browser profile keeps them signed in to stores, so Uber Eats, Amazon or DoorDash often already have their addresses.
- **Fulfillment**: `delivery`, `pickup` or `none` (tickets, digital). Runs have no such field, and we send no `merchantGuidance` (ours would replace Universal Checkout's own default guidance), so it reaches the browser agent only through the task ("pick up…"). Runs started before then carry it as their first guidance line, which `fulfillmentOf` still reads.
- **deliverTo** (deliveries only): `me` (the default), `store_account` (the user said to use the address on the store account) or `someone_else` (another person, named by `addressLabel`).

## What Agent Checkouts does with a profile

- `buyerProfileId` is read once when the run starts and frozen into it. It can't be changed or added later; there is no contact-only profile (shipping is required).
- The browser agent sees the profile as buyer facts (first name, contact email, shipping address line 1, and so on) with `standard` handling. It never sees the profile's label.
- It treats profile facts as lower-priority defaults and reuses them only when they fit the task. A profile holding someone else's address (e.g. a partner's or a parent's) reads as the buyer's own unless told otherwise, so a task that says "send it to my mom" may make it ask again.
- We send no `merchantGuidance`: it goes in verbatim and replaces Universal Checkout's default guidance, which works better on its own.
- Without a profile, nothing fails: when the store needs an address, the agent asks with an ordinary form question (`standard` handling). That question shows in the dock and the in-host card like any other.
- No rule decides between a profile and an address the store account already has; the agent judges from the page.
- Run messages never echo answered values: an input response carries only each field's key, label, `provided`/`omitted` and status. Nothing writes answers back to a profile.

## Decision table

| Order | Saved | What happens |
| --- | --- | --- |
| Pickup or `none` | anything | Starts. Attaches the user's own default (if any) for name, email and phone only. |
| Delivery, `me` | default | Starts with the default. |
| Delivery, `me`, an own place named (`addressLabel: "Work"`) | that label | Starts with it. |
| Delivery, `me` | no default (none saved, or only other people's) | Starts with nothing attached. The store account's address is used, or the store asks in the dock. |
| Delivery, `me`, an own place that isn't saved ("Cabin") | | Starts with nothing attached. |
| Delivery, `store_account` | anything | Starts with nothing attached, even with a default. |
| Delivery, `someone_else` | their label | Starts with theirs. |
| Delivery, `someone_else` | not saved | **Nothing starts.** `needs_address`: the assistant asks for it in chat, saves it and starts again. |
| Any delivery with an unsaved label that resembles saved ones | | Nothing starts. `which_address`: the agent asks one short question. |

"Delivery to the user with a signed-in store account" and "delivery to the user with nothing saved" are one row: we can't see whether the store account has an address, and both start the same way.

## Invariants

- **needs_address only for someone else.** `start` never stops for the user's own address. A test runs every combination of fulfillment, `deliverTo`, label and saved state and checks this. Asking first is the assistant's job (see "Settled in chat" below), so a user who says "use my Amazon address" still starts at once.
- **The default is the user's own place.** Nothing sets it automatically: no "first address becomes the default", no "newest takes over" after a delete, no single-address shortcut. Saving sets it only when the form or the assistant says so. The forms tick "Default for my deliveries" for the user's own place while they have none, and the assistant sets it for the first place the user saves for themselves; neither does for someone else's.
- **Matching is one rule.** A label matches a saved one when their words are the same, ignoring case, punctuation, "my", "our", "the", "'s" and "address" ("my mom" = "Mom"). If none match but some share all their words ("Sarah" and "Sarah Lee"), it's `which_address`; otherwise it's new. Saved labels are unique under the same rule. A pronoun ("her", "his place") is never a label: for `someone_else` it's an error that lists the saved labels, and for `me` it means the default.
- **Someone else's address is attached only when the user names or refers to that person.** The model sets `someone_else` only then; `me` never resolves to a person except through an own place the user named.
- The signed-in agent can read saved profile IDs, labels, default flags, recipient names, contact email and phone, and complete shipping addresses through its read-only address tool. It uses the relevant default or explicitly named recipient; current instructions take priority. Saved profiles remain in Crossmint and never authorize payment. Checkout status still shows only label and place.

## The agent

One contract for the web agent (`checkouts__create`) and the MCP host (`start`), defined once in `shippingFields`: `fulfillment`, `deliverTo` (default `me`), `addressLabel`, `cityHint` (for someone not saved).

## Settled in chat

Every assistant settles a delivery's address in the conversation before starting, with the same four tools under its own names (`address-chat.ts` in the checkouts package):

| Web chat | MCP | What it does |
| --- | --- | --- |
| `checkouts__addresses` | `delivery_addresses` | Lists them, complete (name, contact, shipping, ID, label, default), with a `next` line for the three cases. |
| `checkouts__save_address` | `save_delivery_address` | Saves one the user gave in chat, or changes one by `id` (Crossmint updates the profile in place). |
| `checkouts__delete_address` | `delete_delivery_address` | Deletes one, when the user asks. |
| `checkouts__set_default_address` | `set_default_delivery_address` | Makes one of the user's own places the default, or `null` for none. |

- With a default: start with it and say so ("I'll send it to Home, Madrid, unless you tell me otherwise"). With saved addresses but no default: ask which, or a new one. With none: ask in one message for what the model doesn't already know (the recipient's name, a phone number and the street), work out the city, postcode and country from the street, and confirm them rather than asking for each.
- The label is short and the model picks it from context (Home, Work, Mom; at most 24 characters), asking only if it can't tell. An empty email becomes the user's own (the signed-in email on MCP, the one on their saved addresses in the web chat). `makeDefault` only for the user's own place: when the user asks, or for the first address they save for themselves, never for someone else's.
- Pickups, things that don't ship, and "use the address on my store account" skip all of this.
- When the create tool returns `needs_address` (someone else, not saved; `addressNeeded` on MCP), the model asks for it in chat the same way, saves it as someone else's and starts again. No form, card or link on any surface.

## The UI

- **New chat**: "Add a delivery address" while the user has none; it saves their own place as the default.
- **Addresses** (`/addresses`, in the menu): add (with "Default for my deliveries", ticked while there is none), edit, delete, "Make default" and "Remove default".
- **Save after the store asks**: the store's address question runs through our dock, which posts the answers to the chat ("Answered the store…" with each field's label and value). When those are the user's own street, city and country and nothing is saved, the web agent offers to save them and, if the user agrees, calls `checkouts__save_address`. Crossmint doesn't give the values back, so this only works for answers given in our UI.

## Known limits (Crossmint)

- No fulfillment field: a pickup reaches the browser agent only through the task, and a view can't tell a new pickup from a delivery, so it shows the attached address.
- No way to change or add a profile after start, and no contact-only profile, so a pickup can only borrow contact details from a full address.
- Answered values never come back, so we can't save an address the store collected anywhere other than our own UI.
- A profile label is invisible to the browser agent; who the recipient is reaches it only through the task.
