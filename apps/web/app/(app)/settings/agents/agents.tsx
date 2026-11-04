"use client";

import { useEffect, useState } from "react";
import {
  type Connection,
  loadConnections,
} from "../../../../lib/client/connections";
import { useI18n } from "../../../../lib/i18n/client";
import { AGENT_ICONS, AgentIcon } from "../../../_components/agent-icon";
import { Collapse } from "../../../_components/collapse";
import { ConfirmModal } from "../../../_components/modal";
import { RowSkeleton } from "../../../_components/row-skeleton";
import { ConnectAgent } from "../../connect-agent";
import { bleed, PageSection } from "../../page-shell";
import { rowButton } from "../../settings/section";

/** Before any agent: faded rows with known agents' icons, so the empty list shows what it will hold. */
function GhostAgents() {
  const bar = "h-2.5 rounded-full bg-black/[0.06]";
  return (
    <div
      aria-hidden="true"
      className="divide-y divide-black/[0.04] [mask-image:linear-gradient(to_bottom,#000_25%,rgb(0_0_0/15%))]"
    >
      {AGENT_ICONS.map(({ src }, index) => (
        <div key={src} className="flex items-center gap-3.5 py-3 pr-5 pl-4">
          <span className="inline-flex size-9 flex-none overflow-hidden rounded-[10px] bg-white opacity-60 ring-1 ring-black/[0.06] grayscale-[35%]">
            {/* biome-ignore lint/performance/noImgElement: a fixed local app icon at its natural size */}
            <img src={src} alt="" className="size-full object-cover" />
          </span>
          <span className={`${bar} ${["w-28", "w-20", "w-24"][index % 3]}`} />
          <span className={`${bar} ml-auto w-16`} />
        </div>
      ))}
    </div>
  );
}

/**
 * Agents (Settings): the agents allowed through Stytch Connected Apps, with
 * Disconnect, and connecting another. With none, only how to connect one.
 */
export function Connections({ serverUrl }: { serverUrl: string }) {
  const { m, f } = useI18n();
  const t = m.settings.connections;
  /** Undefined while loading, null when it failed. */
  const [connections, setConnections] = useState<Connection[] | null>();
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  /** The agent being confirmed for disconnecting. */
  const [confirming, setConfirming] = useState<Connection | null>(null);
  /** Disconnected agents collapse out before they leave the list. */
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    void loadConnections().then(setConnections);
  }, []);
  async function disconnect(id: string) {
    setRemoving(id);
    setFailed(false);
    const response = await fetch(`/api/connections/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (response?.ok) {
      setGone((current) => new Set(current).add(id));
      setConfirming(null);
    } else {
      setFailed(true);
    }
    setRemoving(null);
  }
  const left = connections?.filter((item) => !gone.has(item.id)).length ?? 0;
  return (
    <>
      {connections === undefined ? (
        <div className={`${bleed} overflow-hidden`}>
          <RowSkeleton square />
        </div>
      ) : connections === null || connections.length === 0 ? (
        <>
          {connections === null ? (
            <p role="alert" className="text-[13px] text-quiet">
              {t.loadFailed}
            </p>
          ) : null}
          {/* Like the empty transactions table: faded rows, then how to fill them. */}
          <div className={`${bleed} overflow-hidden`}>
            <GhostAgents />
            <div className="relative -mt-24 bg-[radial-gradient(ellipse_65%_75%_at_50%_45%,#fff_55%,rgb(255_255_255/0))]">
              <ConnectAgent serverUrl={serverUrl} bare />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Once every agent is disconnected, the empty list goes too. */}
          {left > 0 ? (
            <PageSection id="connections" title={t.title}>
              <div
                className={`${bleed} divide-y divide-black/[0.05] overflow-hidden`}
              >
                {connections.map((connection) => (
                  <Collapse key={connection.id} open={!gone.has(connection.id)}>
                    <div
                      className={`flex items-center gap-3.5 py-3 pr-2.5 pl-4 transition-opacity duration-200 ${removing === connection.id ? "opacity-50" : ""}`}
                    >
                      <AgentIcon
                        name={connection.name}
                        logoUrl={connection.logoUrl}
                      />
                      <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">
                        {connection.name}
                      </span>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        disabled={removing !== null}
                        onClick={() => {
                          setFailed(false);
                          setConfirming(connection);
                        }}
                        className={rowButton}
                      >
                        {t.disconnect}
                      </button>
                    </div>
                  </Collapse>
                ))}
              </div>
            </PageSection>
          ) : null}
          <ConnectAgent serverUrl={serverUrl} another={left > 0} />
        </>
      )}
      {confirming ? (
        <ConfirmModal
          id="disconnect-title"
          title={f(t.confirmTitle, { name: confirming.name })}
          text={f(t.confirmText, { name: confirming.name })}
          confirm={t.disconnect}
          busyLabel={t.disconnecting}
          cancel={t.cancel}
          busy={removing === confirming.id}
          error={failed ? t.updateFailed : null}
          onConfirm={() => void disconnect(confirming.id)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </>
  );
}
