import type { CheckoutView } from "@oca/client/checkouts";
import { predictionContext, predictionQuestion } from "@oca/client/predictions";
import type { EveMessage } from "eve/react";
import { useEffect, useMemo, useState } from "react";

/** The DOM-free half (packages/client). */
export { predictionContext, predictionQuestion } from "@oca/client/predictions";

/** After a reply or a changed checkout question, independently of typing. */
export function usePrediction(
  messages: readonly EveMessage[],
  ready: boolean,
  run: CheckoutView | null = null,
) {
  const context = useMemo(() => predictionContext(messages), [messages]);
  const checkout = useMemo(() => predictionQuestion(run), [run]);
  const reply = messages.at(-1);
  const blocked = Boolean(run?.pending && !checkout);
  const key = useMemo(
    () =>
      !blocked &&
      (checkout ||
        (reply?.role === "assistant" &&
          reply.parts.some(
            (part) => part.type === "text" && part.text.trim(),
          ) &&
          context.at(-1)?.role === "assistant"))
        ? JSON.stringify({
            reply: reply?.id,
            run: run?.runId,
            request: run?.pending?.requestId,
            messages: context,
            checkout,
          })
        : "",
    [blocked, checkout, context, reply, run?.runId, run?.pending?.requestId],
  );
  const [prediction, setPrediction] = useState({ key: "", text: "" });
  const [dismissed, setDismissed] = useState("");

  useEffect(() => {
    if (!ready || !key) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: JSON.parse(key).messages,
          checkout: JSON.parse(key).checkout,
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => {
          if (
            !controller.signal.aborted &&
            typeof body?.prediction === "string"
          ) {
            setPrediction({ key, text: body.prediction });
          }
        })
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, ready]);

  return {
    text:
      ready && prediction.key === key && dismissed !== key
        ? prediction.text
        : "",
    dismiss: () => setDismissed(key),
  };
}
