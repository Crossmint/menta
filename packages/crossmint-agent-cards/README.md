# @oca/crossmint-agent-cards

A reusable [Eve](https://github.com/vercel/eve) extension for Crossmint Agent Cards. It gives an agent one tool, `manage_cards`, that returns the signed-in page where the user saves and manages cards. Card details are entered only in Crossmint's form on that page, never in chat, and saving a card approves no payment.

## Mount it

In your agent's `agent/extensions/cards.ts`:

```ts
import cards from "@oca/crossmint-agent-cards";

export default cards({
  // Called per tool call; a signed-in page in your app.
  cardsUrl: () => "https://your-app.example/settings/cards",
});
```

Your app must authenticate that page.

## Browser component

`@oca/crossmint-agent-cards/browser` exports `CardManagement`, a thin wrapper over Crossmint's `CrossmintPaymentMethodManagement` limited to cards (saved and new, a new one with its billing address):

```tsx
import { CardManagement } from "@oca/crossmint-agent-cards/browser";

<CardManagement
  jwt={userJwt}
  onCardSelected={({ paymentMethodId, brand, last4 }) => {
    // Your UI's choice. It grants no purchase authority.
  }}
/>;
```

Render it inside a `CrossmintProvider` configured with your client key, and pass a user JWT your Crossmint project trusts (Menta uses Stytch session JWTs). `onCardSelected` gets only the payment method ID, brand and last four. Crossmint's form draws no button since SDK 5, so the component adds one under it (`submitLabel`, `buttonClassName`), enabled once the form is complete, and shows why a submit failed.

## Exports

- `@oca/crossmint-agent-cards`: the Eve extension (config: `cardsUrl`).
- `@oca/crossmint-agent-cards/tools`: the `manage_cards` tool definition.
- `@oca/crossmint-agent-cards/browser`: `CardManagement` and its `CardManagementProps` and `SelectedCard` types.

Build with `pnpm --filter @oca/crossmint-agent-cards build`. The browser component needs `@crossmint/client-sdk-react-ui` 5.0 and React 19, a bundler and a secure context (WebCrypto).
