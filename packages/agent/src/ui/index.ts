/**
 * The checkout step UI both surfaces draw: the web app's dock (apps/web) and
 * the ChatGPT/Claude checkout card (packages/agent/card). React components
 * styled with Tailwind on the tokens in ./theme.css. Payment approval's view,
 * which needs Crossmint's React SDK, is separate: `@oca/agent/ui/approval`.
 */

export {
  type Answer,
  type Draft,
  type FormEntry,
  formAnswers,
  LONG_LIST,
  onePick,
  type Said,
  type UiField,
} from "./answers.js";
export { FadeText } from "./fade-text.js";
export { clock, expiresIn, expiryPhrase, money } from "./format.js";
export { UiLocaleProvider, useUi } from "./i18n/context.js";
export {
  around,
  capitalize,
  EN,
  format,
  localeTag,
  pickLocale,
  UI_LOCALES,
  type Ui,
  type UiLocale,
  type UiMessages,
  uiFor,
} from "./i18n/index.js";
export {
  Arrow,
  Check,
  Chevron,
  Close,
  CrossmintLogo,
  Eye,
  Icon,
  Lock,
  Pin,
  Shield,
} from "./icons.js";
export { PaymentStep, PoweredByCrossmint, Settled } from "./payment.js";
export {
  Asks,
  Choices,
  Mark,
  RequestForm,
  type Submission,
} from "./question.js";
export {
  CancelButton,
  MoreButton,
  RunHeader,
  WatchButton,
} from "./run-header.js";
export {
  blockedReason,
  describeCheckout,
  failureText,
  runStatus,
  type Tone,
} from "./status.js";
export { Dot, StatusDot, toneText } from "./tone.js";
