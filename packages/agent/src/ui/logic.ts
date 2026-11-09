/**
 * The DOM-free half of the checkout step UI: formatting, store-question
 * answers and status labels. The web dock, the in-host card and the mobile
 * app (through `@oca/client`) all use these.
 */

export {
  type Answer,
  type Draft,
  type FormEntry,
  formAnswers,
  LONG_LIST,
  onePick,
  optionsOf,
  type Said,
  type UiField,
} from "./answers.js";
export { clock, expiresIn, expiryPhrase, money } from "./format.js";
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
  blockedReason,
  describeCheckout,
  failureText,
  runStatus,
  type Tone,
} from "./status.js";
