import { permanentRedirect } from "next/navigation";

/** Transactions became Activity. */
export default function TransactionsPage() {
  permanentRedirect("/activity");
}
