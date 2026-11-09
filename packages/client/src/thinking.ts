/**
 * Shown while a reply is pending. Deliberately whimsical and non-literal: they
 * mean "working on it", never a claim about what the agent is doing.
 */
export const thinkingPhrases = [
  "Pondering…",
  "Mulling…",
  "Noodling…",
  "Percolating…",
  "Musing…",
  "Ruminating…",
  "Cogitating…",
  "Contemplating…",
  "Brewing…",
  "Simmering…",
  "Marinating…",
  "Mulling it over…",
  "Chewing on it…",
  "Puzzling…",
  "Scheming…",
  "Daydreaming…",
  "Tinkering…",
  "Conjuring…",
  "Hmm…",
  "Thinking…",
  "Considering…",
  "Deliberating…",
  "Wondering…",
  "Untangling…",
  "Doodling…",
  "Humming…",
  "Churning…",
  "Fermenting…",
  "Stewing…",
  "Musing it over…",
];

export function randomThinkingPhrase() {
  return thinkingPhrases[Math.floor(Math.random() * thinkingPhrases.length)];
}
