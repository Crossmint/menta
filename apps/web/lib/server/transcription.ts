import { gateway } from "ai";

/**
 * Streaming speech-to-text through the AI Gateway: live partials, formatted
 * numbers and prices ("$349", "94043"), about $0.54 per hour of audio.
 */
export const transcriptionModel = "microsoft/mai-transcribe-2-streaming";

/** One dictation, at most. The browser stops recording here. */
export const maxDictationSeconds = 120;

/**
 * The browser opens the transcription socket with this secret right away; it
 * only has to outlive the microphone prompt. Bound to the model above.
 */
const secretSeconds = 60;

/** Dictations a user may start per window (each mints one secret). */
const perWindow = 30;
const windowMs = 10 * 60_000;
const started = new Map<string, number[]>();

/**
 * Whether the user may start another dictation now. Per server instance:
 * enough to stop a runaway client, not a billing control.
 */
export function allowDictation(userId: string, now = Date.now()) {
  const recent = (started.get(userId) ?? []).filter(
    (at) => now - at < windowMs,
  );
  if (recent.length >= perWindow) {
    started.set(userId, recent);
    return false;
  }
  recent.push(now);
  started.set(userId, recent);
  return true;
}

/** Forgets every user's recent dictations (tests). */
export function resetDictationLimits() {
  started.clear();
}

/**
 * A short-lived client secret for one streaming transcription. The Gateway
 * credential stays on the server; the secret can't call other models.
 */
export async function dictationGrant() {
  const { token, expiresAt } =
    await gateway.experimental_transcription.getToken({
      model: transcriptionModel,
      expiresAfterSeconds: secretSeconds,
    });
  return {
    token,
    model: transcriptionModel,
    expiresAt: expiresAt ?? null,
    maxSeconds: maxDictationSeconds,
  };
}

export type DictationGrant = Awaited<ReturnType<typeof dictationGrant>>;
