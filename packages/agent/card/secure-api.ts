/**
 * The contract between the checkout card (small, inline) and its secure-step
 * script (Crossmint's React components, loaded from our origin only when a
 * private field is waiting). Types only.
 */
import type { ProtectedDescriptor } from "./model.js";

export interface SecureCredentials {
  readonly apiKey: string;
  readonly jwt: string;
}

export type CollectResult =
  | {
      readonly ok: true;
      readonly values: Record<string, { protectedInputId: string }>;
    }
  | { readonly ok: false; readonly message: string };

export interface ProtectedMount {
  /** Collects every protected field; values never pass through the card. */
  collect(): Promise<CollectResult>;
  setDisabled(disabled: boolean): void;
  unmount(): void;
}

export interface SecureSurface {
  readonly background: string;
  readonly backgroundSecondary: string;
  readonly border: string;
}

export interface OcaSecure {
  readonly version: 1;
  mountProtected(options: {
    readonly credentials: SecureCredentials;
    /** The card's theme, so Crossmint's frames match it. */
    readonly theme?: "light" | "dark";
    /** The card's language (a supported locale or BCP 47 tag); English by default. */
    readonly locale?: string;
    /** The host's colors under the frames (background, insets, border). */
    readonly surface?: SecureSurface;
    readonly slots: readonly {
      readonly element: HTMLElement;
      readonly descriptor: ProtectedDescriptor;
    }[];
    /** Crossmint's frame answered: the form is live. */
    readonly onAlive: () => void;
    /** The components couldn't render (e.g. a rejected client key). */
    readonly onError: (code: string) => void;
  }): ProtectedMount;
}

declare global {
  interface Window {
    OcaSecure?: OcaSecure;
  }
}
