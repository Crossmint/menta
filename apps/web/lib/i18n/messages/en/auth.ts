/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Sign in",
    heading: "Sign in to Menta",
    lede: "New here? Signing in creates your account.",
    arrivals: {
      checkout: {
        kicker: "A checkout needs you",
        title: "Sign in to continue",
        lede: "Your assistant sent you here for one step. You see the details after you sign in with the account that started it.",
        footer:
          "Approve payments only on Menta. Never type card details into a chat.",
      },
      connect: {
        kicker: "An assistant wants to connect",
        title: "Sign in to connect",
        lede: "Sign in, then choose whether to let your assistant shop with Menta.",
        ledeNamed:
          "Sign in, then choose whether to let {name} shop with Menta.",
        footer:
          "You approve every spending limit here, never in the assistant's chat.",
      },
    },
    googleFailed: "Google sign-in didn't complete. Please try again.",
    invalidEmail: "Enter a valid email address.",
    sendFailed: "We couldn't send a code. Please try again.",
    codeFailed: "That code didn't work. Try again or request a new one.",
    checkEmail: "Check your email",
    codeSent: "Enter the code we sent to {email}.",
    google: "Continue with Google",
    continueEmail: "Continue with email",
    or: "or",
    email: "Email",
    code: "Code",
    emailPlaceholder: "Your email",
    openInbox: "Open {provider}",
    sendCode: "Send code",
    signIn: "Sign in",
    differentEmail: "Use a different email",
    resend: "Send a new code",
    resendIn: "Send a new code in {seconds}s",
    codeResent: "We sent a new code to {email}.",
    password: "Password",
    passwordFailed: "That password didn't work. Try again.",
  },
  authorize: {
    title: "Allow access",
    can: [
      "Start checkouts up to the limit you give",
      "See status and receipts",
      "Cancel a checkout when you ask",
    ],
    cannot: [
      "Approve payments",
      "See card numbers or codes",
      "Change your cards",
    ],
    offline: "We couldn't reach Menta. Check your connection.",
    failed: "Something went wrong. Try again from your assistant.",
    cantConnect: "Can't connect right now",
    returning: "Returning to your assistant…",
    checking: "Checking the request…",
    thisAssistant: "This assistant",
    heading: "Let {name} use Menta?",
    signedInAs: "Signed in as {email} · ",
    notYou: "Not you?",
    itCan: "It can",
    itCant: "It can't",
    ungrantable:
      "Your account can't grant {scopes}, so {name} may not work fully.",
    cancel: "Cancel",
    allow: "Allow",
    returnsTo:
      "You'll return to {returnsTo}. You can disconnect it at any time in {connections}.",
    connections: "Connections",
  },
  notFound: {
    title: "Page not found",
    lede: "This page doesn't exist or has moved.",
    home: "Go to Menta",
  },
  /**
   * The sign-in code email Stytch sends (lib/auth/code-email.ts); {minutes} is the code's lifetime.
   * `label` sits right above the digits, the way Gmail ("Copy code") and iOS Mail (AutoFill) find codes.
   */
  codeEmail: {
    subject: "Your Menta sign-in code",
    heading: "Your sign-in code",
    enter: "Enter this code on Menta to sign in.",
    label: "Verification code",
    expires: "It expires in {minutes} minutes.",
    share: "Don't share it with anyone, not even your assistant.",
    ignore: "Didn't try to sign in? You can ignore this email.",
  },
};
