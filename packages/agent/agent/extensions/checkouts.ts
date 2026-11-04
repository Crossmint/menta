import checkouts from "@oca/crossmint-agent-checkouts";
import {
  attributedCheckouts,
  crossmintUserId,
  getCheckouts,
} from "../../src/crossmint.js";

/** Checkouts the web chat starts are noted as its own (Transactions' Agent column). */
const fromChat = async () => "Menta chat";

export default checkouts({
  checkouts: () => attributedCheckouts(getCheckouts(), fromChat),
  userId: crossmintUserId,
});
