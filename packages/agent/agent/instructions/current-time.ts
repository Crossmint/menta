import { defineDynamic, defineInstructions } from "eve/instructions";

export default defineDynamic({
  events: {
    "turn.started": () =>
      defineInstructions({
        content: `Current time at the start of this turn: ${new Date().toISOString()} (UTC). Use this live clock for relative dates such as today, tomorrow, next and upcoming. Compare event start times in the event's local time zone, or the user's explicitly supplied time zone; do not assume UTC is the user's local date.`,
      }),
  },
});
