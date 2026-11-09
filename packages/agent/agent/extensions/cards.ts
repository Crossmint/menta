import cards from "@oca/crossmint-agent-cards";
import { webOrigin } from "../../src/env.js";

export default cards({ cardsUrl: () => `${webOrigin()}/wallet` });
