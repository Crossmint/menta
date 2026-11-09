"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addressLine, type SavedAddress } from "../../../../lib/buyer-details";
import { useAccount } from "../../../../lib/client/account";
import {
  makeDefaultAddress,
  type Saved,
} from "../../../../lib/client/addresses";
import { useI18n } from "../../../../lib/i18n/client";
import { useCountries } from "../../../_components/address-form";
import { AddressForm } from "../../../_components/address-steps";
import { Collapse } from "../../../_components/collapse";
import { Plus } from "../../../_components/icons";
import { ConfirmModal, Modal, ModalHeader } from "../../../_components/modal";
import { RowMenu } from "../../../_components/row-menu";
import { RowSkeleton } from "../../../_components/row-skeleton";

/** One saved address: label, default chip, one summary line and its actions. */
function AddressRow({
  address,
  busy,
  onEdit,
  onMakeDefault,
  onDelete,
}: {
  address: SavedAddress;
  busy: boolean;
  onEdit: () => void;
  onMakeDefault: () => void;
  onDelete: () => void;
}) {
  const { m, f } = useI18n();
  const t = m.settings.addresses;
  const countries = useCountries();
  const countryName = (code: string) =>
    countries.find((item) => item.code === code)?.name ?? code;
  return (
    <div className="flex flex-col py-2.5 pr-2 pl-4">
      <div className="flex min-w-0 items-center gap-1">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-medium">{address.label}</span>
          {address.isDefault ? (
            <span className="flex-none animate-[fade-in_200ms_ease-out] rounded-full bg-chip px-2 py-1 text-[12px] leading-none font-medium text-soft motion-reduce:animate-none">
              {t.default}
            </span>
          ) : null}
        </span>
        <RowMenu
          label={f(t.moreNamed, { label: address.label })}
          title={address.label}
          disabled={busy}
          actions={[
            {
              key: "default",
              label: address.isDefault ? t.removeDefault : t.makeDefault,
              onSelect: onMakeDefault,
            },
            { key: "edit", label: t.edit, onSelect: onEdit },
            {
              key: "delete",
              label: t.delete,
              onSelect: onDelete,
              danger: true,
            },
          ]}
        />
      </div>
      <p className="truncate pr-2 text-[13px] text-muted">
        {addressLine(address.details, countryName)}
      </p>
    </div>
  );
}

/** How long a deleted row takes to fade and collapse (see Collapse). */
const collapseMs = 240;

/**
 * Saved addresses, each a Crossmint buyer profile with a label. Checkouts use
 * the default unless the user names another; the default is our own record.
 */
function Addresses() {
  const { m, f } = useI18n();
  const t = m.settings.addresses;
  const { me } = useAccount();
  const [addresses, setAddresses] = useState<SavedAddress[] | undefined>();
  const [loadFailed, setLoadFailed] = useState(false);
  /** The address being edited, "new" for the add form, or null. */
  const [editing, setEditing] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deleting, setDeleting] = useState<ReadonlySet<string>>(new Set());
  /** Only the newest "Make default" click's answer counts. */
  const choosing = useRef(0);
  /** Addresses saved in this visit ease in rather than pop in. */
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState("");
  /** The address being confirmed for deleting. */
  const [confirming, setConfirming] = useState<SavedAddress | null>(null);

  useEffect(() => {
    void fetch("/api/addresses", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { addresses: SavedAddress[] } | null) => {
        if (body) {
          setAddresses(body.addresses);
        } else {
          setLoadFailed(true);
        }
      })
      .catch(() => setLoadFailed(true));
  }, []);

  // "Add an address" in an assistant's settings links to #add-address.
  useEffect(() => {
    if (window.location.hash === "#add-address") {
      setEditing("new");
    }
  }, []);

  const list = addresses ?? [];
  const hasDefault = list.some((address) => address.isDefault);
  const fallback = list.find((address) => address.isDefault)?.details.contact;
  const contact = {
    email: fallback?.email ?? me?.email ?? null,
    phone: fallback?.phone ?? null,
  };

  function saved({ id, addresses: next }: Saved) {
    if (editing === "new") {
      setAdded((current) => new Set(current).add(id));
    }
    setAddresses(next);
    setEditing(null);
  }

  // Optimistic: the chip moves (or goes) at once and comes back if saving fails.
  async function toggleDefault(id: string, value: boolean) {
    const before = addresses;
    const attempt = ++choosing.current;
    setError("");
    setAddresses((current) =>
      current?.map((address) => ({
        ...address,
        isDefault: value && address.id === id,
      })),
    );
    const updated = await makeDefaultAddress(id, value);
    if (attempt !== choosing.current) {
      return;
    }
    if (updated) {
      setAddresses(updated);
    } else {
      setAddresses(before);
      setError(t.defaultFailed);
    }
  }

  // Optimistic: the row collapses at once and comes back if the delete fails.
  async function remove(address: SavedAddress) {
    setError("");
    setDeleting((current) => new Set(current).add(address.id));
    const [response] = await Promise.all([
      fetch(`/api/addresses/${encodeURIComponent(address.id)}`, {
        method: "DELETE",
      }).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, collapseMs)),
    ]);
    const body = (await response?.json().catch(() => null)) as {
      addresses?: SavedAddress[];
    } | null;
    if (response?.ok && body?.addresses) {
      setAddresses(body.addresses);
    } else if (response?.status === 404) {
      setAddresses((current) =>
        current?.filter((item) => item.id !== address.id),
      );
    } else {
      setError(f(t.deleteFailed, { label: address.label }));
    }
    setDeleting((current) => {
      const next = new Set(current);
      next.delete(address.id);
      return next;
    });
  }

  const empty = addresses !== undefined && list.length === 0;
  const edited = list.find((address) => address.id === editing) ?? null;

  return (
    <>
      {addresses === undefined ? (
        <div className="panel overflow-hidden">
          {loadFailed ? (
            <p className="m-0 px-5 py-4 text-[13px] text-muted">
              {t.loadFailed}
            </p>
          ) : (
            <RowSkeleton icon={false} />
          )}
        </div>
      ) : empty ? (
        // The first address: faded rows for what will be here, then what to do.
        <div className="panel flex flex-col items-center gap-5 overflow-hidden pb-8 text-center">
          <GhostAddresses />
          {/* Up over the fading rows, like the empty transactions table. */}
          <div className="relative -mt-20 bg-[radial-gradient(ellipse_65%_75%_at_50%_45%,#fff_55%,rgb(255_255_255/0))] flex flex-col items-center gap-1.5 px-6">
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.03em]">
              {t.first}
            </h2>
            <p className="m-0 max-w-[440px] text-[15px] text-pretty text-quiet">
              {t.empty}
            </p>
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setEditing("new")}
            className="raised tap relative h-11 rounded-full bg-ink px-5 font-medium text-white hover:bg-ink-hover"
          >
            {t.add}
          </button>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {list.map((address, index) => (
            <Collapse
              key={address.id}
              open={!deleting.has(address.id)}
              appear={added.has(address.id)}
            >
              <div className={index > 0 ? "border-t border-black/[0.05]" : ""}>
                <AddressRow
                  address={address}
                  busy={deleting.has(address.id)}
                  onEdit={() => setEditing(address.id)}
                  onMakeDefault={() =>
                    void toggleDefault(address.id, !address.isDefault)
                  }
                  onDelete={() => setConfirming(address)}
                />
              </div>
            </Collapse>
          ))}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setEditing("new")}
            className="flex w-full items-center gap-2 border-t border-black/[0.05] px-5 py-3.5 text-left font-medium text-soft transition-colors hover:bg-black/[0.04] hover:text-ink"
          >
            <Plus width={15} height={15} className="flex-none" />
            {t.add}
          </button>
        </div>
      )}
      {error ? (
        <p
          role="alert"
          className="animate-[fade-in_150ms_ease-out] text-[13px] text-danger motion-reduce:animate-none"
        >
          {error}
        </p>
      ) : null}
      {list.length > 1 ? (
        <p className="m-0 text-[13px] text-muted">{t.defaultNote}</p>
      ) : null}
      {/* Once the list is in: a new address's contact and default checkbox come from it. */}
      {editing && addresses !== undefined ? (
        <Modal
          labelledBy="address-title"
          busy={savingAddress}
          onClose={() => setEditing(null)}
        >
          {(close) => (
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <ModalHeader
                id="address-title"
                title={edited ? f(t.editNamed, { label: edited.label }) : t.add}
                close={close}
              />
              <AddressForm
                onBusy={setSavingAddress}
                address={edited}
                contact={contact}
                hasDefault={hasDefault}
                onSaved={saved}
                onCancel={close}
              />
            </div>
          )}
        </Modal>
      ) : null}
      {confirming ? (
        <ConfirmModal
          id="delete-address-title"
          title={f(t.deleteTitle, { label: confirming.label })}
          text={t.deleteText}
          confirm={t.delete}
          busyLabel={t.deleting}
          cancel={t.cancel}
          busy={deleting.has(confirming.id)}
          onConfirm={() => {
            const address = confirming;
            setConfirming(null);
            void remove(address);
          }}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </>
  );
}

/** Two faded address rows: what the list will hold once one is added. */
function GhostAddresses() {
  const bar = "h-2.5 rounded-full bg-black/[0.06]";
  return (
    <div
      aria-hidden="true"
      className="w-full divide-y divide-black/[0.04] [mask-image:linear-gradient(to_bottom,#000_25%,rgb(0_0_0/15%))]"
    >
      {["w-16", "w-24"].map((width) => (
        <div key={width} className="flex flex-col gap-2 px-5 py-4 text-left">
          <span className="flex items-center gap-2">
            <span className={`${bar} ${width}`} />
            <span className="h-4 w-12 rounded-full bg-black/[0.04]" />
          </span>
          <span className={`${bar} w-56 max-w-full`} />
        </div>
      ))}
    </div>
  );
}

/** Delivery addresses (Settings): saved addresses and the default, or how to add the first. */
export function AddressesPage() {
  const router = useRouter();
  // Older links named cards on the same page as addresses (/settings/payments#cards).
  useEffect(() => {
    if (window.location.hash === "#cards") {
      router.replace("/wallet#cards");
    }
  }, [router]);
  return <Addresses />;
}
