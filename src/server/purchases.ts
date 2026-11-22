import { db, must } from "./supabase";
import { HttpError, E } from "./http";
import type { Auth } from "./auth";
import { PRICING, isItemKey } from "@/config/pricing";
import { quote } from "./pi-price";
import { hasActivePlan } from "./credits";
import { approvePayment, cancelPayment, completePayment, getPayment, type PiPayment } from "./pi-backend";
import { completedProperly, memoFor, paymentMismatch, type PurchaseRef } from "./payment-verify";

const UUID_RE = /^[0-9a-f-]{36}$/;

type PurchaseRow = PurchaseRef & { status: string };

export async function createPurchase(a: Auth, itemKey: unknown) {
  if (!isItemKey(itemKey)) throw E.bad("عنصر غير معروف.", "Unknown item.");
  const item = PRICING[itemKey];
  // Renewal opens only after the current 30 days end (no stacking while the plan is active).
  if (item.kind === "plan" && (await hasActivePlan(a.username))) {
    throw new HttpError(409, "plan_active", "خطتك الحالية ما زالت فعّالة. يفتح التجديد عند انتهائها.", "Your current plan is still active. Renewal opens when it ends.");
  }
  const q = await quote(item.key); // live OKX rate, rounded up to a whole Pi
  const row = must(
    await db().from("hl_purchases").insert({ username: a.username, kind: item.kind, item_key: item.key, amount_pi: q.pricePi, status: "pending" }).select("id").single(),
  ) as { id: string };
  // Amount and memo are decided on the server; the client only passes them to the Pi SDK.
  return { purchaseId: row.id, amount: q.pricePi, usd: q.usd, rate: q.rate.usdPerPi, memo: memoFor(item.key), metadata: { purchaseId: row.id, item: item.key } };
}

type Payer = { username: string; uid: string };
async function purchaseForPayment(a: Payer, payment: PiPayment): Promise<PurchaseRow> {
  const pid = String((payment.metadata as { purchaseId?: unknown } | undefined)?.purchaseId ?? "");
  if (!UUID_RE.test(pid)) throw payErr("wrong_memo");
  const p = must(await db().from("hl_purchases").select("id,username,kind,item_key,amount_pi,pi_payment_id,status,created_at").eq("id", pid).maybeSingle()) as PurchaseRow | null;
  if (!p || p.username !== a.username) throw payErr("wrong_payer");
  return p;
}

function payErr(reason: string) {
  console.error("[payment] rejected:", reason);
  return new HttpError(400, "payment_rejected", "تعذّر التحقق من الدفعة، لم يتم منح أي شيء.", "The payment could not be verified. Nothing was granted.", { reason });
}

async function failPurchase(id: string, reason: string) {
  await db().from("hl_purchases").update({ status: "failed", fail_reason: reason }).eq("id", id).in("status", ["pending", "approved"]);
}

/** Server approval: verify the payment against our purchase row first, then approve it with Pi. */
export async function approve(a: Auth, paymentId: string) {
  console.log("[payment] approve start", paymentId.slice(0, 8), a.username);
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
export async function complete(a: Payer, paymentId: string, txid: string) {
  console.log("[payment] complete start", paymentId.slice(0, 8), a.username);
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

/** Recover a payment the app never finished (user closed the app, network drop...). Idempotent and fully re-verified. */
export async function reconcileOne(user: Payer, purchaseId: string, paymentId: string) {
  const payment = await getPayment(paymentId);
  if (payment.status.cancelled || payment.status.user_cancelled) {
    await db().from("hl_purchases").update({ status: "cancelled", fail_reason: "cancelled_at_pi" }).eq("id", purchaseId).in("status", ["pending", "approved"]);
    return "cancelled";
  }
  if (payment.transaction?.txid) {
    await complete(user, paymentId, payment.transaction.txid);
    return "completed";
  }
  return "waiting";
}

export async function reconcileMine(a: Auth): Promise<void> {
  const rows = must(
    await db().from("hl_purchases").select("id,pi_payment_id").eq("username", a.username).in("status", ["pending", "approved"]).not("pi_payment_id", "is", null).gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString()).limit(5),
  ) as { id: string; pi_payment_id: string }[];
  for (const r of rows) {
    try { await reconcileOne({ username: a.username, uid: a.uid }, r.id, r.pi_payment_id); } catch (e) { console.error("[reconcile]", r.id, e instanceof Error ? e.message : e); }
  }
}

/**
 * Pi reports a payment the app never finished ("incomplete payment"). If its transaction exists we complete it
 * (fully re-verified); otherwise we cancel it so the user can start a new payment. Only the payer can trigger this.
 */
export async function handleIncomplete(a: Payer, paymentId: string) {
  const payment = await getPayment(paymentId);
  if (payment.user_uid !== a.uid) throw payErr("wrong_payer");
  const pid = String((payment.metadata as { purchaseId?: unknown } | undefined)?.purchaseId ?? "");
  if (!UUID_RE.test(pid)) throw payErr("wrong_memo");
  const row = must(await db().from("hl_purchases").select("id,username,status").eq("id", pid).maybeSingle()) as { id: string; username: string; status: string } | null;
  if (!row || row.username !== a.username) throw payErr("wrong_payer");
  if (payment.transaction?.txid) {
    await complete(a, paymentId, payment.transaction.txid);
    return { result: "completed" as const };
  }
  if (!payment.status.cancelled && !payment.status.user_cancelled && !payment.status.developer_completed) await cancelPayment(paymentId);
  await db().from("hl_purchases").update({ status: "cancelled", fail_reason: "incomplete_cancelled" }).eq("id", row.id).in("status", ["pending", "approved"]);
  return { result: "cancelled" as const };
}
