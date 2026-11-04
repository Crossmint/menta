/**
 * The card's secure-step script: Crossmint's own React components for private
 * store fields, styled like the web app's (`src/ui/approval.tsx`). Served from
 * our origin (/mcp/card/secure.js) and loaded by the checkout card only when a
 * step needs it, so the card itself stays small. Values typed into
 * Crossmint's frames never reach this script; it only sees protectedInputIds.
 */
import {
  CrossmintProtectedInput,
  CrossmintProvider,
} from "@crossmint/client-sdk-react-ui";
import { Component, createRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { protectedAppearance, setSurface } from "../src/ui/approval.js";
import { uiFor } from "../src/ui/i18n/index.js";
import type {
  CollectResult,
  OcaSecure,
  SecureCredentials,
} from "./secure-api.js";

type Handle = {
  collect(): Promise<
    | { status: "collected"; input: { protectedInputId: string } }
    | { status: "invalid" | "unavailable"; code: string; message: string }
    | { status: "superseded"; message: string }
  >;
};

/** Calls `onAlive` once, when one of Crossmint's frames first posts to us. */
function watchAlive(onAlive: () => void) {
  let done = false;
  const listener = (event: MessageEvent) => {
    if (
      !done &&
      /^https:\/\/([a-z0-9-]+\.)?crossmint\.com$/.test(event.origin)
    ) {
      done = true;
      window.removeEventListener("message", listener);
      onAlive();
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

/** Any render failure in Crossmint's components (a rejected key, a bad prop) becomes a fallback. */
class Guard extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function provider(
  credentials: SecureCredentials,
  onError: () => void,
  children: ReactNode,
) {
  return (
    <Guard onError={onError}>
      <CrossmintProvider
        apiKey={credentials.apiKey}
        jwt={credentials.jwt}
        consoleLogLevel="silent"
      >
        {children}
      </CrossmintProvider>
    </Guard>
  );
}

const secure: OcaSecure = {
  version: 1,

  mountProtected({
    credentials,
    slots,
    theme = "light",
    locale,
    surface,
    onAlive,
    onError,
  }) {
    setSurface(surface ?? null);
    const host = document.createElement("div");
    host.hidden = true;
    document.body.append(host);
    const root = createRoot(host);
    const refs = new Map<string, RefObject<Handle | null>>(
      slots.map((slot) => [slot.descriptor.key, createRef<Handle>()]),
    );
    const appearance = protectedAppearance(theme);
    const stop = watchAlive(onAlive);
    const draw = (disabled: boolean) =>
      root.render(
        provider(
          credentials,
          () => onError("render_failed"),
          slots.map((slot) =>
            createPortal(
              <CrossmintProtectedInput
                // biome-ignore lint/suspicious/noExplicitAny: the SDK's ref type is not exported
                ref={refs.get(slot.descriptor.key) as any}
                jwt={credentials.jwt}
                // biome-ignore lint/suspicious/noExplicitAny: Crossmint's descriptor, rebuilt by the card
                field={slot.descriptor as any}
                appearance={appearance}
                disabled={disabled}
              />,
              slot.element,
              slot.descriptor.key,
            ),
          ),
        ),
      );
    draw(false);
    return {
      async collect(): Promise<CollectResult> {
        const values: Record<string, { protectedInputId: string }> = {};
        for (const slot of slots) {
          const handle = refs.get(slot.descriptor.key)?.current;
          if (!handle) {
            return { ok: false, message: uiFor(locale).m.secure.notReady };
          }
          const result = await handle.collect();
          if (result.status !== "collected") {
            return { ok: false, message: result.message };
          }
          values[slot.descriptor.key] = {
            protectedInputId: result.input.protectedInputId,
          };
        }
        return { ok: true, values };
      },
      setDisabled: draw,
      unmount() {
        stop();
        root.unmount();
        host.remove();
      },
    };
  },
};

window.OcaSecure = secure;
