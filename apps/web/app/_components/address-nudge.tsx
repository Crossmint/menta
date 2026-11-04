"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { splitName } from "../../lib/buyer-details";
import { useAccount } from "../../lib/client/account";
import { startingContact, useSavedAddresses } from "../../lib/client/addresses";
import { Plus } from "./icons";
import { Modal, ModalHeader } from "./modal";

// The form carries the subdivision and phone data; the chat loads it only once the chip is clicked.
const AddressForm = dynamic(
  () => import("./address-steps").then((m) => m.AddressForm),
  { ssr: false, loading: () => <div className="min-h-[420px]" /> },
);

/**
 * A quiet chip on the new-chat screen while the user has no address: it
 * opens the Addresses tab's form in the app's modal, right here, and goes away once
 * an address is saved. It saves the user's own place as their default, so
 * stores don't have to ask where deliveries to them go.
 */
export function AddressNudge() {
  const { me } = useAccount();
  const [addresses, setAddresses] = useSavedAddresses();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);

  // The modal stays mounted until it has closed, so saving the first address
  // closes it like any other modal instead of unmounting it mid-view.
  const saved = Boolean(addresses && addresses.length > 0);
  if (!addresses || !me || (saved && !open)) {
    return null;
  }
  const contact = startingContact(addresses, me);
  return (
    <>
      {saved ? null : (
        <button
          ref={chip}
          type="button"
          onClick={() => setOpen(true)}
          // Above the headline, out of the flow: it arrives after the page and
          // mustn't push the centered headline and composer.
          className="absolute bottom-full left-1/2 mb-3 inline-flex h-8 -translate-x-1/2 whitespace-nowrap animate-[fade-in_240ms_ease-out] items-center gap-2 rounded-full border border-line-card bg-white pr-3 pl-1.5 text-[13px] font-medium text-soft raised-light hover:text-ink motion-reduce:animate-none"
        >
          <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-chip text-ink">
            <Plus width={12} height={12} />
          </span>
          Add a delivery address
          <span className="font-normal text-muted max-sm:hidden">
            · so checkouts don’t ask
          </span>
        </button>
      )}
      {open ? (
        <Modal
          labelledBy="address-nudge-title"
          busy={saving}
          onClose={() => {
            setOpen(false);
            if (!saved) {
              chip.current?.focus({ preventScroll: true });
            }
          }}
        >
          {(close) => (
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              <ModalHeader
                id="address-nudge-title"
                title="Add a delivery address"
                lede="Deliveries use it, so the store doesn’t have to ask."
                close={close}
              />
              {/* The same form as the Addresses tab: their first address, their own, the default. */}
              <AddressForm
                onBusy={setSaving}
                address={null}
                contact={contact}
                start={{ label: "Home", ...splitName(contact.name ?? "") }}
                hasDefault={false}
                onSaved={(result) => {
                  setAddresses(result.addresses);
                  close();
                }}
                onCancel={close}
              />
            </div>
          )}
        </Modal>
      ) : null}
    </>
  );
}
