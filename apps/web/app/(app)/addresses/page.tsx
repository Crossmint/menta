import { permanentRedirect } from "next/navigation";

/** Delivery addresses live in Settings. The redirect names no fragment, so `#add-address` carries over. */
export default function AddressesPage() {
  permanentRedirect("/settings/delivery-addresses");
}
