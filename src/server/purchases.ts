import { db, must } from "./supabase";
import { HttpError, E } from "./http";
import type { Auth } from "./auth";
import { PRICING, isItemKey } from "@/config/pricing";
import { approvePayment, completePayment, getPayment, type PiPayment } from "./pi-backend";
import { completedProperly, memoFor, paymentMismatch, type PurchaseRef } from "./payment-verify";

const UUID_RE = /^[0-9a-f-]{36}$/;

type PurchaseRow = PurchaseRef & { status: string };

export async function createPurchase(a: Auth, itemKey: unknown) {
  if (!isItemKey(itemKey)) throw E.bad("عنصر غير معروف.", "Unknown item.");
  const item = PRICING[itemKey];
  const row = must(
    await db().from("hl_purchases").insert({ username: a.username, kind: item.kind, item_key: item.key, amount_pi: item.pricePi, status: "pending" }).select("id").single(),
  ) as { id: string };
  // Amount and memo are decided on the server; the client only passes them to the Pi SDK.
  return { purchaseId: row.id, amount: item.pricePi, memo: memoFor(item.key), metadata: { purchaseId: row.id, item: item.key } };
}

async function purchaseForPayment(a: Auth, payment: PiPayment): Promise<PurchaseRow> {
  const pid = String((payment.metadata as { purchaseId?: unknown } | undefined)?.purchaseId ?? "");
  if (!UUID_RE.test(pid)) throw payErr("wrong_memo");
  const p = must(await db().from("hl_purchases").select("id,username,kind,item_key,amount_pi,pi_payment_id,status").eq("id", pid).maybeSingle()) as PurchaseRow | null;
  if (!p || p.username !== a.username) throw payErr("wrong_payer");
  return p;
}

function payErr(reason: string) {
  return new HttpError(400, "payment_rejected", "تعذّر التحقق من الدفعة، لم يتم منح أي شيء.", "The payment could not be verified. Nothing was granted.", { reason });
}

async function failPurchase(id: string, reason: string) {
  await db().from("hl_purchases").update({ status: "failed", fail_reason: reason }).eq("id", id).in("status", ["pending", "approved"]);
}

/** Server approval: verify the payment against our purchase row first, then approve it with Pi. */
export async function approve(a: Auth, paymentId: string) {
  const payment = await getPayment(paymentId);
  const purchase = await purchaseForPayment(a, payment);
  if (purchase.status !== "pending" && purchase.status !== "approved") throw payErr("purchase_not_open");
  const bad = paymentMismatch(payment, purchase, a.uid);
  if (bad) {
    await failPurchase(purchase.id, bad);
    throw payErr(bad);
  }
  // A Pi payment id can be attached to only one purchase (unique index).
  if (purchase.pi_payment_id && purchase.pi_payment_id !== paymentId) throw payErr("payment_id_mismatch");
  if (!purchase.pi_payment_id) {
    const r = await db().from("hl_purchases").update({ pi_payment_id: paymentId, status: "approved" }).eq("id", purchase.id).is("pi_payment_id", null);
    if (r.error) throw payErr("payment_id_already_used");
  }
  if (!payment.status.developer_approved) await approvePayment(paymentId);
  return { approved: true };
}

/** Server completion: re-verify with the Pi API, complete, confirm, then grant atomically. */
export async function complete(a: Auth, paymentId: string, txid: string) {
  if (!txid) throw E.bad();
  const payment = await getPayment(paymentId);
  const purchase = await purchaseForPayment(a, payment);
  if (purchase.status === "completed") return { completed: true, already: true };
  if (purchase.status !== "pending" && purchase.status !== "approved") throw payErr("purchase_not_open");
  const bad = paymentMismatch(payment, purchase, a.uid);
  if (bad) {
    await failPurchase(purchase.id, bad);
    throw payErr(bad);
  }
  if (purchase.pi_payment_id && purchase.pi_payment_id !== paymentId) throw payErr("payment_id_mismatch");
  if (!payment.transaction?.txid || payment.transaction.txid !== txid) throw payErr("txid_mismatch");
  if (!purchase.pi_payment_id) {
    const r = await db().from("hl_purchases").update({ pi_payment_id: paymentId }).eq("id", purchase.id).is("pi_payment_id", null);
    if (r.error) throw payErr("payment_id_already_used");
  }

  const done = payment.status.developer_completed ? payment : await completePayment(paymentId, txid);
  if (!completedProperly(done, txid)) throw payErr("not_completed");

  const item = PRICING[purchase.item_key as keyof typeof PRICING];
  const res = must(await db().rpc("hl_complete_purchase", { p_purchase: purchase.id, p_txid: txid, p_credits: item.credits, p_days: item.days })) as string;
  return { completed: true, already: res === "already_completed" };
}

export async function cancel(a: Auth, purchaseId: string, reason: string) {
  await db().from("hl_purchases").update({ status: reason === "error" ? "failed" : "cancelled", fail_reason: reason }).eq("id", purchaseId).eq("username", a.username).in("status", ["pending", "approved"]);
}
