import type { TranscriptionStreamPart } from "ai";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/** Raw 16-bit mono PCM at this rate is what the transcription socket takes. */
const sampleRate = 24_000;
/** After Stop, how long to wait for the last words before keeping what we have. */
const finishTimeoutMs = 8_000;

/**
 * What the transcription stream has said so far: segments it finalized, words
 * it committed in the current segment, and its live guess at what follows.
 */
export interface Transcript {
  readonly done: string;
  readonly committed: string;
  readonly partial: string;
}

export const emptyTranscript: Transcript = {
  done: "",
  committed: "",
  partial: "",
};

/**
 * Folds one stream part into the transcript. Deltas are append-only and a
 * partial is a revisable guess at the text after them; a final replaces the
 * segment's deltas with its formatted text.
 */
export function nextTranscript(
  transcript: Transcript,
  part: TranscriptionStreamPart,
): Transcript {
  switch (part.type) {
    case "transcript-delta":
      return {
        ...transcript,
        committed: transcript.committed + part.delta,
        partial: "",
      };
    case "transcript-partial":
      return { ...transcript, partial: part.text };
    case "transcript-final":
      return {
        done: joinWords(transcript.done, part.text),
        committed: "",
        partial: "",
      };
    default:
      return transcript;
  }
}

export function transcriptText(transcript: Transcript) {
  return joinWords(
    transcript.done,
    transcript.committed + transcript.partial,
  ).trim();
}

function joinWords(a: string, b: string) {
  const left = a.trim();
  const right = b.trim();
  return left && right ? `${left} ${right}` : left || right;
}

/** Puts dictated text between what was before and after the caret, spaced like typing. */
export function spliceDictation(before: string, text: string, after: string) {
  if (!text) {
    return before + after;
  }
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  return `${before}${lead}${text}${trail}${after}`;
}

/** Microphone loudness (RMS) to a 0..1 meter value on a dB scale. */
export function meterLevel(rms: number) {
  if (rms <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (20 * Math.log10(rms) + 60) / 45));
}

export class DictationError extends Error {}

function failure(error: unknown) {
  if (error instanceof DictationError) {
    return error.message;
  }
  // The microphone and audio APIs fail with DOMExceptions; the socket doesn't.
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Microphone access is off. Allow it in your browser's site settings to dictate.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No microphone found.";
      case "NotReadableError":
        return "Your microphone is in use by another app.";
    }
    return "Your microphone isn't available right now.";
  }
  return "Voice input lost its connection. Try again.";
}

/**
 * Runs in the audio thread: averages the microphone down (or holds it up) to
 * 24 kHz, sends 100 ms of 16-bit PCM at a time, and reports loudness ~20×/s.
 */
const worklet = `
class DictationCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const rate = options.processorOptions.rate;
    this.step = sampleRate / rate;
    this.chunk = new Int16Array(Math.round(rate / 10));
    this.n = 0; this.t = 0; this.acc = 0; this.count = 0; this.last = 0;
    this.energy = 0; this.frames = 0; this.levelEvery = Math.round(sampleRate / 20);
    this.port.onmessage = () => { this.flush(); this.port.postMessage({ flushed: true }); };
  }
  flush() {
    if (this.n > 0) {
      const pcm = this.chunk.slice(0, this.n).buffer;
      this.port.postMessage({ pcm }, [pcm]);
      this.n = 0;
    }
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      const x = channel[i];
      this.energy += x * x; this.frames++;
      this.acc += x; this.count++; this.t++;
      while (this.t >= this.step) {
        const y = this.count > 0 ? this.acc / this.count : this.last;
        this.last = y; this.acc = 0; this.count = 0; this.t -= this.step;
        const s = Math.max(-1, Math.min(1, y));
        this.chunk[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        if (this.n === this.chunk.length) this.flush();
      }
    }
    if (this.frames >= this.levelEvery) {
      this.port.postMessage({ level: Math.sqrt(this.energy / this.frames) });
      this.energy = 0; this.frames = 0;
    }
    return true;
  }
}
registerProcessor("dictation-capture", DictationCapture);
`;

let workletUrl: string | undefined;

interface Grant {
  token: string;
  model: string;
  maxSeconds: number;
}

async function requestGrant(signal: AbortSignal): Promise<Grant> {
  const response = await fetch("/api/transcription", {
    method: "POST",
    cache: "no-store",
    signal,
  }).catch((error) => {
    if (signal.aborted) {
      throw error;
    }
    throw new DictationError("Voice input couldn't connect. Try again.");
  });
  if (response.status === 401) {
    throw new DictationError("Sign in again to use voice input.");
  }
  if (response.status === 429) {
    throw new DictationError(
      "Too many voice inputs. Try again in a few minutes.",
    );
  }
  if (!response.ok) {
    throw new DictationError("Voice input isn't available right now.");
  }
  return (await response.json()) as Grant;
}

interface Session {
  readonly abort: AbortController;
  readonly before: string;
  readonly after: string;
  readonly original: string;
  cancelled: boolean;
  /** The last composer value this session wrote. */
  value: string;
  context?: AudioContext;
  media?: MediaStream;
  node?: AudioWorkletNode;
  audio?: ReadableStreamDefaultController<Uint8Array>;
  audioClosed: boolean;
  finishTimer?: ReturnType<typeof setTimeout>;
}

function closeAudio(session: Session) {
  if (!session.audioClosed) {
    session.audioClosed = true;
    try {
      session.audio?.close();
    } catch {}
  }
}

function releaseInput(session: Session) {
  for (const track of session.media?.getTracks() ?? []) {
    track.stop();
  }
  session.node?.disconnect();
  if (session.context && session.context.state !== "closed") {
    void session.context.close().catch(() => {});
  }
}

export type DictationStatus = "idle" | "starting" | "listening" | "finishing";

/**
 * Dictation into a text field: streams the microphone to the transcription
 * model and writes the live transcript at the caret. Nothing is sent; the
 * text stays in the field for review.
 */
export function useDictation({
  value,
  onChange,
  input,
}: {
  value: string;
  onChange: (value: string) => void;
  input: RefObject<HTMLTextAreaElement | null>;
}) {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [limit, setLimit] = useState(120);
  const level = useRef(0);
  const session = useRef<Session | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const startedAt = useRef(0);

  const write = useCallback((current: Session, next: string) => {
    current.value = next;
    change.current(next);
  }, []);

  const stop = useCallback(() => {
    const current = session.current;
    if (
      !current ||
      current.cancelled ||
      current.audioClosed ||
      current.finishTimer
    ) {
      return;
    }
    if (!current.node) {
      // Still asking for the microphone: nothing heard, nothing to keep.
      current.cancelled = true;
      current.abort.abort();
      return;
    }
    setStatus("finishing");
    for (const track of current.media?.getTracks() ?? []) {
      track.stop();
    }
    current.node.port.postMessage("flush");
    setTimeout(() => closeAudio(current), 300);
    current.finishTimer = setTimeout(
      () => current.abort.abort(),
      finishTimeoutMs,
    );
  }, []);

  const cancel = useCallback(() => {
    const current = session.current;
    if (!current || current.cancelled) {
      return;
    }
    current.cancelled = true;
    current.abort.abort();
    write(current, current.original);
  }, [write]);

  const start = useCallback(async () => {
    if (session.current) {
      return;
    }
    const field = input.current;
    const caret = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? caret;
    const current: Session = {
      abort: new AbortController(),
      before: value.slice(0, caret),
      after: value.slice(end),
      original: value,
      value,
      cancelled: false,
      audioClosed: false,
    };
    session.current = current;
    setError(null);
    setElapsed(0);
    setStatus("starting");
    const { signal } = current.abort;
    let completed = false;
    try {
      if (
        !window.isSecureContext ||
        typeof AudioWorkletNode === "undefined" ||
        typeof navigator.mediaDevices?.getUserMedia !== "function"
      ) {
        throw new DictationError(
          "Voice input needs a secure (HTTPS) page in a current browser.",
        );
      }
      // Created inside the tap so mobile Safari lets it play.
      const context = new AudioContext();
      current.context = context;
      void context.resume().catch(() => {});
      // The secret and the SDK load while the microphone prompt is up.
      const ready = Promise.all([requestGrant(signal), import("ai")]);
      ready.catch(() => {});
      const [media] = await Promise.all([
        navigator.mediaDevices
          .getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          })
          .then((media) => {
            current.media = media;
            return media;
          }),
        (async () => {
          workletUrl ??= URL.createObjectURL(
            new Blob([worklet], { type: "text/javascript" }),
          );
          await context.audioWorklet.addModule(workletUrl);
        })(),
      ]);
      if (signal.aborted) {
        return;
      }
      // Capture starts now; audio queues here until the socket is open, so
      // the first words aren't lost.
      const audio = new ReadableStream<Uint8Array>({
        start: (controller) => {
          current.audio = controller;
        },
      });
      const node = new AudioWorkletNode(context, "dictation-capture", {
        processorOptions: { rate: sampleRate },
      });
      current.node = node;
      node.port.onmessage = ({ data }) => {
        if (typeof data.level === "number") {
          level.current = meterLevel(data.level);
        }
        if (data.pcm && !current.audioClosed) {
          current.audio?.enqueue(new Uint8Array(data.pcm));
        }
        if (data.flushed) {
          closeAudio(current);
        }
      };
      context.createMediaStreamSource(media).connect(node);
      // Kept in the graph so every browser runs it; it outputs silence.
      node.connect(context.destination);
      await context.resume();
      startedAt.current = performance.now();
      setStatus("listening");
      field?.focus();

      const [grant, sdk] = await ready;
      setLimit(grant.maxSeconds);
      const result = sdk.experimental_streamTranscribe({
        model: sdk
          .createGateway({ apiKey: grant.token })
          .transcription(grant.model),
        audio,
        inputAudioFormat: { type: "audio/pcm", rate: sampleRate },
        abortSignal: signal,
      });
      let transcript = emptyTranscript;
      for await (const part of result.fullStream) {
        if (current.cancelled) {
          break;
        }
        if (part.type === "error") {
          throw part.error;
        }
        transcript = nextTranscript(transcript, part);
        write(
          current,
          spliceDictation(
            current.before,
            transcriptText(transcript),
            current.after,
          ),
        );
      }
      completed = true;
    } catch (caught) {
      if (!signal.aborted && !current.cancelled) {
        setError(failure(caught));
      }
    } finally {
      clearTimeout(current.finishTimer);
      current.abort.abort();
      closeAudio(current);
      releaseInput(current);
      level.current = 0;
      session.current = null;
      setStatus("idle");
      if (!current.cancelled || completed) {
        const field = input.current;
        if (field) {
          // Caret after the dictated words, ready to edit or send.
          const at = current.value.length - current.after.length;
          field.focus();
          field.setSelectionRange(at, at);
        }
      }
    }
  }, [input, value, write]);

  // Elapsed time, and the stop at the length limit.
  useEffect(() => {
    if (status !== "listening") {
      return;
    }
    const timer = setInterval(() => {
      const seconds = Math.floor(
        (performance.now() - startedAt.current) / 1000,
      );
      setElapsed(seconds);
      if (seconds >= limit) {
        setError(
          `Voice input stops after ${Math.round(limit / 60)} minutes. Review and send, or dictate more.`,
        );
        stop();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [status, limit, stop]);

  // Leaving the page mid-dictation releases the microphone.
  useEffect(
    () => () => {
      const current = session.current;
      if (current) {
        current.cancelled = true;
        current.abort.abort();
        releaseInput(current);
      }
    },
    [],
  );

  return {
    status,
    active: status !== "idle",
    elapsed,
    level,
    error,
    dismissError: useCallback(() => setError(null), []),
    start,
    stop,
    cancel,
  };
}
