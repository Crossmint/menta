/**
 * English: the source every other language of the checkout UI (the in-host
 * card, its secure step, and the shared step components the web app's dock
 * and secure page draw) is translated from. `{name}` placeholders are filled
 * in by `format`; keep them, and keep " · " separators, as written.
 *
 * Only what people read lives here. Text the model reads (MCP `next` lines,
 * tool descriptions, model-context notes and the messages the card sends as
 * the user) stays English in the code that writes it.
 */
export const en = {
  common: {
    yes: "Yes",
    no: "No",
    tryAgain: "Try again",
    cancel: "Cancel",
    /** "Powered by" and Crossmint's logo; `{logo}` is where the logo goes. */
    poweredBy: "Powered by {logo}",
    /** A store's own words, quoted. */
    quoted: "“{text}”",
  },
  /** A checkout's state, as chips, the dock's header and settled cards say it. */
  status: {
    starting: "Starting",
    working: "Working",
    readyToPay: "Ready to pay",
    needsAnswer: "Needs your answer",
    needsSecureStep: "Needs a secure step",
    storeQuestion: "Store question",
    needsYou: "Needs you",
    orderPlaced: "Order placed",
    couldntBuy: "Couldn't buy",
    couldntBuyBecause: "Couldn't buy · {reason}",
    blocked: "Blocked",
    notConfirmed: "Not confirmed",
    stopped: "Stopped",
    canceled: "Canceled",
    done: "Done",
    cancelingWaiting: "Canceling · waiting for the store",
    approvedWaiting: "Approved · waiting for the store",
    sentWaiting: "Sent · waiting for the store",
  },
  /** Why the store stopped a checkout (Crossmint's blocked codes), in a few words. */
  blocked: {
    "merchant.access_blocked": "Store blocked access",
    "merchant.checkout_error": "Store checkout error",
    "merchant.fulfillment_unavailable": "Can't deliver there",
    "merchant.human_verification_required": "Store wants a human check",
    "merchant.no_safe_path": "No safe way to check out",
    "merchant.payment_declined": "Payment declined",
    "policy.max_cost_exceeded": "Over your limit",
    "product.item_unavailable": "Item unavailable",
    "product.requested_option_unavailable": "Option unavailable",
  },
  /** Why a checkout failed (Crossmint's failure reasons), in a sentence. */
  failures: {
    browser_session_lost: "The connection to the store was lost.",
    browser_location_unsupported:
      "The store isn't available from our location.",
    cost_limit: "The total would have gone over your limit.",
    input_expired: "The store's request expired before it was answered.",
    model_error: "The checkout agent ran into a problem.",
    runtime_error: "The checkout stopped before it finished.",
    accounting_unavailable: "Crossmint couldn't confirm the payment state.",
    cancelled: "The checkout was canceled.",
    reconciliation_required:
      "We can't tell if the store placed this order. Don't buy it again yet: it could charge you twice.",
    /** Any other reason. */
    other: "The checkout stopped before it finished.",
  },
  /** How a checkout ended, in the card's body. */
  outcome: {
    receipt: "Order confirmed by the store. Receipt captured.",
    noReceipt:
      "The store confirmed the order. No receipt was captured, so check your email for the store's confirmation.",
    total: "Total",
    order: "Order {id}",
    deliveringTo: "Delivering to {label} · {place}",
  },
  /** What a checkout is doing while it works, under a card's one line. */
  progress: {
    stillWorking: "Still working…",
  },
  /** A card whose step has passed. */
  settled: {
    answered: "Answered",
    approved: "Approved",
    sentSecurely: "Sent securely",
    /** What the user did, then how the checkout ended ("Approved · Order placed"). */
    doneThen: "{done} · {outcome}",
    shownAbove: "Shown above",
    waitingBelow: "Waiting on you below",
    started: "Checkout started · up to {amount}",
    showItHere: "Show it here",
  },
  /** A store's question, answered in place. */
  form: {
    choosePlaceholder: "Choose…",
    showMore: "Show more",
    showLess: "Show less",
    somethingElse: "Something else",
    somethingElsePlaceholder: "Tell the store what you want instead",
    backToOptions: "Back to the options",
    sentWaiting: "Sent. Waiting for the store.",
    answerInChat: "Answer in chat.",
    /** The button under a list of options: "Choose Medium". */
    choose: "Choose {name}",
    sending: "Sending…",
    send: "Send",
    sendSecurely: "Send securely",
    secretNote: "Goes straight to the store. I never see it.",
    secretNoteAssistant:
      "Goes straight to the store. Your assistant never sees it.",
    /** How long a request has left; `{time}` is "4 min". */
    expiresIn: "expires in {time}",
    /** When a request expires later today or another day; `{time}` is "3:42 PM". */
    expiresAt: "expires {time}",
    expiringNow: "expiring now",
  },
  /** The payment step. */
  payment: {
    exactTo: "Exact amount to {merchant}",
    upToTo: "Up to this amount to {merchant}",
    deliveryTo: "Delivery to {label} · {place}",
    approvedWaiting: "Approved. Waiting for the store.",
    sending: "Sending your approval to the store…",
    securedNote: "Secured by Crossmint. Nothing is charged until you approve.",
    setUpLimit: "Set up a spending limit",
    /** Above the button, as the spending limit request page says it. */
    lede: "Set how much your assistant can spend on your card, for this order and the next ones. Revoke it any time.",
  },
  /** Approving a payment with a saved card (Crossmint's components around ours). */
  approval: {
    payWith: "Pay with",
    chooseCard: "Choose a card",
    addCard: "Add a card",
    securityCode: "Security code",
    cvcFront: "Enter the 4-digit code on the front of your card.",
    cvcBack: "Enter the 3-digit code on the back of your card.",
    cvcNote:
      "Crossmint keeps this code. The store and your assistant never see it.",
    useDifferentCard: "Use a different card",
    cardsDidntLoad: "Your saved cards didn't load.",
    orAddHere: "or add one here.",
    addHereOrMenta: "Add one here, or approve on Menta.",
    approve: "Approve {amount}",
    approving: "Approving…",
    waitingCheck: "Waiting for your card check…",
    confirming: "Confirming with your card…",
    approved: "Approved",
    /** A saved card's expiry; `{date}` is "08/29". */
    expires: "Expires {date}",
    noRail: "This card can't be used for agent payments yet. Try another card.",
    visaRefused:
      "Visa didn't accept this store for agent payments. Try another card.",
    mastercardRefused:
      "Mastercard didn't accept this store for agent payments. Try another card.",
    expired: "This approval expired. Ask your assistant to try again.",
    create: "Couldn't start the payment with this card. Try again.",
    register: "Couldn't set up this card for agent payments. Try again.",
    check: "The card check didn't go through. Try again or use another card.",
    slow: "Your card hasn't confirmed yet. Try again in a moment.",
    notRevoked:
      "Couldn't cancel this spending limit. Revoke it in Spending limits on Menta.",
  },
  /** Private details for the store, in Crossmint's secure fields. */
  secure: {
    /** Above the fields: what the store asks for, by Crossmint's input hints; `{store}` is its name. */
    signInTitle: "Sign in to {store}",
    signInLine: "{store} is asking you to sign in to continue the order.",
    newPasswordTitle: "Create your {store} password",
    codeTitle: "Enter the code {store} sent you",
    codeLine: "Check your email or phone for it.",
    detailsTitle: "{store} needs a few private details",
    fillOnMenta: "Fill it in on Menta",
    fillOnMentaNote:
      "Enter it securely on Menta. It goes straight to the store, and your assistant never sees it.",
    loading: "Loading Crossmint's secure form…",
    notReady: "The secure field isn't ready.",
  },
  /** The dock's header row and its controls. */
  header: {
    /** After "+2": the next checkout's button. */
    more: "more",
    moreLabel: "Show the next checkout ({count} more)",
    watchLive: "Watch live",
    watching: "Watching",
    closeLiveView: "Close live view",
    cancelCheckout: "Cancel checkout",
  },
  /** The in-host card's own lines. */
  card: {
    noCheckout: "No checkout",
    waiting: "Waiting for the checkout…",
    connecting: "Connecting to the host…",
    onlyInHosts: "This card shows checkouts inside ChatGPT or Claude.",
    nothingToShow: "No checkout to show here. Ask for its status in chat.",
    whichAddress: "Which address should it go to? Answer in the chat.",
    whereTo: "Where should it go? Answer in the chat.",
    didntStart: "Didn't start: {reason}",
    cantShow:
      "Menta couldn't show this checkout here. Ask for its status in chat.",
    cantRefresh: "Can't refresh right now. Retrying.",
    couldntSend: "Couldn't send that. Try again, or answer in chat.",
    answerFailed: "That answer didn't go through. Showing the latest state.",
    somethingWrong: "Something went wrong. Try again.",
    pausedUpdates: "Paused updates.",
    checkAgain: "Check again",
    backToChat: "Back to chat",
    backInChat: "Back in chat",
  },
};

/** Every language has exactly this shape (checked by the compiler). */
export type UiMessages = typeof en;
