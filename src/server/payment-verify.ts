import { PRICING, type ItemKey } from "@/config/pricing";
import type { PiPayment } from "./pi-backend";

export type PurchaseRef = { id: string; username: string; kind: "plan" | "pack"; item_key: string; amount_pi: number | string; pi_payment_id: string | null };

/** Short, human-readable English memo shown in the Pi wallet. The purchase id travels in payment metadata. */
export const memoFor = (itemKey: string): string => {
  const i = PRICING[itemKey as ItemKey];
  if (!i) return "Healthy";
  return i.kind === "plan" ? "Healthy Monthly Plan" : `Healthy ${i.credits} Credits`;
};

/**
 * Pure verification of a Pi payment against our purchase row. Returns a reason string on mismatch,
 * or null when every check passes. Nothing is granted unless this returns null.
 *  - amount equals the config price for the item (NOT the amount stored by the client)
 *  - memo matches the item (the purchase id is carried in metadata and must belong to the payer)
 *  - payer is the same Pi user who created the purchase
 *  - direction is user_to_app and the payment was not cancelled
 */
export function paymentMismatch(payment: PiPayment, purchase: PurchaseRef, payerUid: string): string | null {
  const item = PRICING[purchase.item_key as ItemKey];
  if (!item || item.kind !== purchase.kind) return "unknown_item";
  if (Math.abs(Number(payment.amount) - item.pricePi) > 1e-7) return "wrong_amount";
  if (Math.abs(Number(purchase.amount_pi) - item.pricePi) > 1e-7) return "stale_price";
  if (payment.memo !== memoFor(purchase.item_key)) return "wrong_memo";
  if (payment.user_uid !== payerUid) return "wrong_payer";
  if (payment.direction !== "user_to_app") return "wrong_direction";
  if (payment.status?.cancelled || payment.status?.user_cancelled) return "cancelled";
  return null;
}

/** After /complete: the Pi API must report developer_completed and a verified transaction. */
export function completedProperly(payment: PiPayment, txid: string): boolean {
  return !!payment.status?.developer_completed && !payment.status?.cancelled && payment.transaction?.txid === txid && payment.transaction?.verified !== false;
}
