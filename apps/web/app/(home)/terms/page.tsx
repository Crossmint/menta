import type { Metadata } from "next";
import { LEGAL, SUPPORT } from "../../../lib/site";
import { DocLink } from "../document";
import { Clause, Contact, LegalPage } from "../legal";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms for using Menta, the plugin that lets your AI assistant buy, book and order online.",
  alternates: { canonical: LEGAL.terms },
};

/** Menta's terms of service, in English (the binding text). */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="November 2, 2026"
      intro={
        <>
          These terms are an agreement between you and Crossmint, which operates
          Menta. Menta is a plugin and web app that lets AI assistants such as
          ChatGPT, Claude and Grok Bot buy, book and order things at online
          stores for you. By using Menta, you agree to these terms and to our{" "}
          <DocLink href={LEGAL.privacy}>privacy policy</DocLink>. If you don't
          agree, don't use Menta.
        </>
      }
    >
      <Clause number={1} title="Who can use Menta">
        <p>
          You must be at least 18 and able to enter into a binding contract. If
          you use Menta for a business, you confirm that you can bind that
          business to these terms.
        </p>
      </Clause>

      <Clause number={2} title="What Menta does">
        <p>
          Menta connects your assistant to online stores. Your assistant can
          look for what you ask for, and a checkout agent fills in the store's
          checkout for it: your cart, delivery details and the store's
          questions. It stops before paying, so you can approve or cancel.
        </p>
        <p>
          You can use Menta from a connected assistant, through the Menta plugin
          and its server, or in the web app at menta.crossmint.com.
        </p>
        <p>
          <strong>Menta isn't the seller.</strong> Each purchase is between you
          and the store. The store sets the price, taxes and delivery charges,
          and it's responsible for the order, delivery, quality, returns and
          refunds, under its own terms.
        </p>
      </Clause>

      <Clause number={3} title="Your account">
        <p>
          You sign in with an emailed code or with Google. Give accurate
          information and keep your email account secure: you're responsible for
          what happens in your Menta account. Tell us right away if you think
          someone else has used it.
        </p>
        <p>
          When you connect an assistant, you allow it to use Menta's tools for
          you, within the limits in these terms. You can disconnect any
          assistant at any time in Connections.
        </p>
      </Clause>

      <Clause number={4} title="Cards and agentic tokens">
        <p>
          You add a card in a secure form run by Crossmint, which keeps card
          details in a vault certified to the PCI DSS standard. Menta and your
          assistant never see your full card number or security code. Menta only
          shows a card's brand, last four digits and expiry date.
        </p>
        <p>
          Menta doesn't issue cards. When your agent pays, it uses an{" "}
          <strong>agentic token</strong>: a payment credential tied to your own
          card, issued through Visa or Mastercard for purchases made by AI
          agents. Your card network may ask you to confirm it's you, with a
          passkey or a code. Where a store or card can't take an agentic token,
          Crossmint pays with your card from its vault, and may ask you to enter
          your card's security code again.
        </p>
        <p>
          Either way, the charge comes from your own card, under your agreement
          with your card issuer and the card network's rules. Your issuer may
          charge its own fees, such as for currency conversion. Menta doesn't
          hold your money and isn't a bank, a wallet or a money transmitter.
        </p>
      </Clause>

      <Clause number={5} title="Your agent, your approvals">
        <p>
          Your assistant acts for you, following your instructions. Each
          checkout has a price limit, which your assistant sets from what you
          tell it, and the checkout agent can't spend more than that.
        </p>
        <ul>
          <li>
            <strong>Only you can approve a payment.</strong> Approval happens in
            Menta's own approval screen: on the web, on Menta's secure page, or
            in Menta's card inside your assistant. The AI model can't approve a
            payment.
          </li>
          <li>
            An approval covers the store and the amount you see, and can be used
            for one payment or several, up to that amount. It expires if it
            isn't used, and until then you can cancel it in Wallet.
          </li>
          <li>
            When you approve, you authorize those charges to your card, and the
            purchases are yours.
          </li>
          <li>
            AI assistants can make mistakes, such as choosing the wrong item,
            size or quantity. Check the store, the items and the total before
            you approve.
          </li>
          <li>
            You're responsible for the instructions you give your assistant. We
            don't control the assistant or what you ask it to do.
          </li>
        </ul>
        <p>
          Until you approve, you can cancel a checkout at any time. After you
          approve, cancelling, returning or getting a refund depends on the
          store. For a charge you don't recognize, contact your card issuer and
          us.
        </p>
      </Clause>

      <Clause number={6} title="Using Menta responsibly">
        <p>Don't use Menta to:</p>
        <ul>
          <li>buy anything illegal, or break any law or sanction;</li>
          <li>
            use a card, account or address you aren't allowed to use, or commit
            fraud;
          </li>
          <li>
            get around approvals, price limits or other safeguards, or disrupt
            Menta, the stores or the checkout agent;
          </li>
          <li>misuse a store's site, or break its terms.</li>
        </ul>
        <p>
          We can suspend or close an account that breaks these terms or puts
          other people, stores or Menta at risk.
        </p>
        <p>
          Menta's source code is open source under its own license. These terms
          cover the Menta service that Crossmint runs.
        </p>
      </Clause>

      <Clause number={7} title="Other services">
        <p>
          Menta works with services run by others: the assistants you connect
          (such as ChatGPT by OpenAI, Claude by Anthropic and Grok Bot), the
          stores you buy from, card networks and issuers, and Stytch for
          sign-in. Their own terms apply when you use them. We aren't
          responsible for their services, availability or content.
        </p>
      </Clause>

      <Clause number={8} title="Disclaimers">
        <p>
          Menta is provided as is and as available. We don't promise that it
          will always work, that a store will accept an order, or that what an
          assistant or Menta tells you, such as a price, stock or delivery date,
          is correct. The store's checkout and your approval screen show what
          you'll actually pay.
        </p>
      </Clause>

      <Clause number={9} title="Limitation of liability">
        <p>
          To the extent the law allows, Crossmint isn't liable for indirect,
          incidental, special or consequential losses, or for lost profits or
          data.
        </p>
        <p>
          Nothing in these terms takes away rights you have as a consumer that
          can't be waived.
        </p>
      </Clause>

      <Clause number={10} title="Ending">
        <p>
          You can stop using Menta at any time and disconnect your assistants in
          Connections. To delete your account, email{" "}
          <DocLink href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</DocLink>.
          We may stop offering Menta, or part of it, and will try to tell you
          first.
        </p>
      </Clause>

      <Clause number={11} title="Changes to these terms">
        <p>
          We may update these terms. We'll post the new version here with a new
          date and, for important changes, tell you in Menta or by email. If you
          keep using Menta after a change, you accept the new terms.
        </p>
      </Clause>

      <Clause number={12} title="Contact">
        <Contact />
      </Clause>
    </LegalPage>
  );
}
