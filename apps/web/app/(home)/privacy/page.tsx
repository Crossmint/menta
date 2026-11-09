import type { Metadata } from "next";
import { LEGAL, SUPPORT } from "../../../lib/site";
import { CookieSwitch } from "../../_components/cookie-banner";
import { DocLink } from "../document";
import { Clause, Contact, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Menta collects, why, who it shares it with, and your choices.",
  alternates: { canonical: LEGAL.privacy },
};

/**
 * Menta's privacy policy, in English (the binding text). It describes what
 * the code does: keep it in step when data flows change (docs/EDD.md).
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="November 3, 2026"
      intro={
        <>
          This policy explains what Menta collects, how we use it, who we share
          it with, and the choices you have. Menta is operated by Crossmint. The
          policy covers the Menta web app, the Menta plugin and its server, and
          Menta's card inside the assistants you connect. Using Menta means you
          accept this policy and our{" "}
          <DocLink href={LEGAL.terms}>terms of service</DocLink>.
        </>
      }
    >
      <Clause number={1} title="What you give us">
        <ul>
          <li>
            <strong>Your account:</strong> your email address and, if you sign
            in with Google, your name and profile picture. Sign-in is handled by
            Stytch, which keeps these details.
          </li>
          <li>
            <strong>Your addresses:</strong> the addresses you save, each with a
            label, name, email, phone number and address, kept by Crossmint.
            Menta keeps which one is your default.
          </li>
          <li>
            <strong>Your chats with Menta:</strong> the messages, photos and
            voice messages you send in Menta's web chat, your answers to a
            store's questions, and the notes Menta saves to remember your
            preferences.
          </li>
          <li>
            <strong>Your location, if you share it:</strong> we turn it into
            your neighborhood, city and postal code, and don't keep your exact
            coordinates.
          </li>
          <li>
            <strong>Your settings:</strong> the assistants you connect, your
            notification devices, and, if you set them up, Grok Bot updates and
            the key that sends them.
          </li>
        </ul>
        <p>
          <strong>Card details never reach Menta.</strong> You enter a card in a
          secure form run by Crossmint, which keeps it in a vault certified to
          the PCI DSS standard. Menta only sees a card's brand, last four digits
          and expiry date. Store passwords and verification codes go through
          protected fields to the store, never through a chat, your assistant or
          Menta's logs.
        </p>
      </Clause>

      <Clause number={2} title="What we collect as you use Menta">
        <ul>
          <li>
            <strong>Your purchases:</strong> each checkout's store, what you
            asked for, its price limit, status, total and receipt, and the
            payments you approve. Crossmint keeps these as your purchase
            history.
          </li>
          <li>
            <strong>Store sign-ins:</strong> when you sign in to a store during
            a checkout, the checkout's browser keeps you signed in there for
            your next purchases, until you sign out of all stores in Settings.
          </li>
          <li>
            <strong>Technical data:</strong> records of requests to Menta, such
            as your IP address and browser, kept to run Menta, secure it and fix
            problems. We use your IP address to pick the stores and currency the
            homepage shows, and don't store it for that.
          </li>
          <li>
            <strong>
              How you use the site, if you accept analytics cookies:
            </strong>{" "}
            the pages you visit and what you click (with the text on screen
            hidden), your browser and device, and your rough location from your
            IP address. We use it to see which parts of Menta work and which
            don't. We don't record your screen.
          </li>
        </ul>
      </Clause>

      <Clause number={3} title="How we use it">
        <p>
          We use your information to run Menta: to sign you in, run your
          checkouts at stores, answer you in the web chat, show your cards,
          addresses and history, ask for your approval, send the updates you
          turn on, prevent fraud and abuse, meet our legal obligations, and
          improve Menta.
        </p>
        <p>
          <strong>We don't sell your information</strong>, and we don't use it
          for advertising.
        </p>
      </Clause>

      <Clause number={4} title="Who we share it with">
        <p>We share only what each one needs to do its part:</p>
        <ul>
          <li>
            <strong>Crossmint's checkout and card services</strong>, which run
            each checkout at the store with what you asked for, its price limit
            and your address, keep your cards and addresses, and process the
            payments you approve.
          </li>
          <li>
            <strong>The store</strong>, which gets what it needs to fulfil your
            order, such as your name, address, email and phone. The order is in
            your name.
          </li>
          <li>
            <strong>Card networks and your card issuer</strong>, such as Visa
            and Mastercard, to verify and process the payments you approve.
          </li>
          <li>
            <strong>The assistant you connect</strong> (such as ChatGPT, Claude
            or Grok Bot). It gets the results of what it asks Menta to do, such
            as a checkout's store, items, price and status and the label and
            city of the address it ships to. Menta's card inside it also gets
            your name, email and phone to fill in forms, and your saved cards'
            brand and last four digits. Answers you give in the card, and short
            notes such as which payment you approved, go into your conversation
            with it. The assistant's own privacy policy covers what it does with
            them.
          </li>
          <li>
            <strong>AI model providers</strong>, through Vercel's AI Gateway:
            Anthropic, to answer you in the web chat and suggest replies;
            OpenAI, to name your chats from their recent messages; and
            Microsoft, to transcribe your voice messages. What they get includes
            your chat, its photos, Menta's notes about you, your checkouts and,
            when needed, your saved addresses. Web searches in the chat go to
            Exa, a search provider.
          </li>
          <li>
            <strong>Service providers</strong> that run Menta for us: Stytch for
            sign-in, Vercel for hosting and for storing your chats, Neon for our
            database, OpenStreetMap to look up a location you share, your
            browser's push service (Google, Apple, Mozilla or Microsoft) for
            notifications you turn on, and PostHog for usage analytics if you
            accept them.
          </li>
          <li>
            <strong>Checkout updates:</strong> when ChatGPT asks to follow a
            checkout, or you set up Grok Bot updates, we send that checkout's
            progress to them.
          </li>
          <li>
            <strong>Authorities</strong>, when the law requires it, and a buyer
            or successor if Crossmint's business is sold or merged.
          </li>
        </ul>
      </Clause>

      <Clause number={5} title="How long we keep it">
        <ul>
          <li>
            Your account, addresses, Menta's notes and your connections stay
            until you delete them or ask us to delete your account.
          </li>
          <li>
            Your chats are stored for a limited time. Deleting a chat removes it
            from your chats right away, and its stored copy is deleted when that
            time ends.
          </li>
          <li>
            Purchase records are kept as long as the law requires, which can be
            several years after you close your account.
          </li>
          <li>
            Technical records, such as notification deliveries and location
            lookups, are kept for days or hours.
          </li>
        </ul>
      </Clause>

      <Clause number={6} title="How we protect it">
        <p>
          Your information is encrypted in transit and at rest, and keys we keep
          for you are sealed. Card details stay in Crossmint's PCI DSS vault.
          Our logs are designed to leave out what you write, your addresses and
          your keys, and only people who need access to run Menta have it. No
          system is perfectly secure, so we can't promise it will never be
          breached.
        </p>
      </Clause>

      <Clause number={7} title="Your choices and rights">
        <p>
          In Menta, you can delete chats and Menta's notes about you, change or
          delete addresses, remove cards, cancel approvals, sign out of all
          stores, disconnect assistants and turn off notifications, at any time.
        </p>
        <p>
          Depending on where you live, you may also have the right to access,
          correct, delete or get a copy of your information, and to object to or
          limit how we use it. To delete your account or make any of these
          requests, email{" "}
          <DocLink href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</DocLink>.
          We answer within 30 days, and may keep what the law requires, such as
          purchase records.
        </p>
      </Clause>

      <Clause number={8} title="Cookies">
        <p>
          Menta uses cookies to keep you signed in, finish a sign-in where you
          started it, remember your language, and recognize a device you get
          notifications on. These are needed for Menta to work.
        </p>
        <p>
          With your consent, we also use an analytics cookie from PostHog to
          learn how the site is used. We ask the first time you visit; until you
          accept, it isn't set and nothing is sent to PostHog, and declining
          changes nothing else. We don't use advertising cookies. Crossmint's
          secure card forms may use their own. If you block cookies, you can't
          sign in. You can turn the analytics cookie on or off here at any time.
        </p>
        <CookieSwitch />
      </Clause>

      <Clause number={9} title="Children">
        <p>
          Menta is for people 18 and older. We don't knowingly collect
          information from anyone younger, and we delete it if we find out we
          have.
        </p>
      </Clause>

      <Clause number={10} title="Where your information goes">
        <p>
          Crossmint is based in the United States, and your information may be
          processed there and in other countries where our providers work. When
          it moves between countries, we protect it as the law requires.
        </p>
      </Clause>

      <Clause number={11} title="Changes to this policy">
        <p>
          We may update this policy. We'll post the new version here with a new
          date and, for important changes, tell you in Menta or by email.
        </p>
      </Clause>

      <Clause number={12} title="Contact">
        <Contact />
      </Clause>
    </LegalPage>
  );
}
