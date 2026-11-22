"use client";
// Pi SDK wrappers (client). All trust decisions happen on the server.
import { api } from "./api";

type PiPaymentDTO = { identifier: string; transaction?: { txid: string } | null };
type PiCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: PiPaymentDTO) => void;
};
declare global {
  interface Window {
    Pi?: {
      init: (c: { version: string; sandbox?: boolean }) => void;
      authenticate: (scopes: string[], onIncomplete: (p: PiPaymentDTO) => void) => Promise<{ accessToken: string; user: { uid: string; username?: string } }>;
      createPayment: (data: { amount: number; memo: string; metadata: Record<string, unknown> }, cb: PiCallbacks) => void;
    };
  }
}

export const isPiBrowser = () => typeof window !== "undefined" && !!window.Pi;
let inited = false;
function init() {
  if (inited || !window.Pi) return;
  window.Pi.init({ version: "2.0", sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true" });
  inited = true;
}

/** A payment left open by an earlier session: finish it on the server (which re-verifies everything). */
let pendingRecovery: Promise<void> = Promise.resolve();
function recoverIncomplete(p: PiPaymentDTO) {
  // Server decides: complete it if the transaction exists, otherwise cancel the stuck payment.
  pendingRecovery = api("/payments/incomplete", { body: { paymentId: p.identifier } }).then(() => undefined, () => undefined);
}

export async function piSignIn(): Promise<string> {
  if (!window.Pi) throw new Error("not_pi_browser");
  init();
  const auth = await window.Pi.authenticate(["username", "payments"], recoverIncomplete);
  return auth.accessToken;
}

export type PayResult = { ok: true } | { ok: false; reason: "cancelled" | "error"; ar?: string; en?: string };

/** Standard U2A flow: create payment -> server approve -> user signs -> server complete (verified). */
export async function payWithPi(item: "plan_monthly" | "pack_small" | "pack_large"): Promise<PayResult> {
  if (!window.Pi) return { ok: false, reason: "error", ar: "افتح التطبيق من Pi Browser لإتمام الدفع.", en: "Open the app in Pi Browser to pay." };
  init();
  // A saved app session does not mean the Pi SDK is authenticated in this page load. Without the "payments"
  // scope (or with an unfinished earlier payment) createPayment fails, so authenticate first and settle leftovers.
  try {
    await window.Pi.authenticate(["username", "payments"], recoverIncomplete);
    await pendingRecovery;
  } catch (e) {
    return { ok: false, reason: "error", ar: "تعذّر تفعيل صلاحية الدفع من Pi. أعد المحاولة.", en: `Could not enable Pi payments (${e instanceof Error ? e.message.slice(0, 60) : "auth"}). Please retry.` };
  }
  const purchase = await api<{ purchaseId: string; amount: number; memo: string; metadata: Record<string, unknown> }>("/purchases", { body: { item } });
  return new Promise<PayResult>((resolve) => {
    let settled = false;
    const done = (r: PayResult) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    try {
    window.Pi!.createPayment(
      { amount: purchase.amount, memo: purchase.memo, metadata: purchase.metadata },
      {
        onReadyForServerApproval: (paymentId) => {
          api("/payments/approve", { body: { paymentId } }).catch((e) => done({ ok: false, reason: "error", ar: e.ar, en: e.en }));
        },
        onReadyForServerCompletion: (paymentId, txid) => {
          api("/payments/complete", { body: { paymentId, txid } })
            .then(() => done({ ok: true }))
            .catch((e) => done({ ok: false, reason: "error", ar: e.ar, en: e.en }));
        },
        onCancel: () => {
          api("/payments/cancel", { body: { purchaseId: purchase.purchaseId, reason: "cancelled" } }).catch(() => {});
          done({ ok: false, reason: "cancelled" });
        },
        onError: (error) => {
          api("/payments/cancel", { body: { purchaseId: purchase.purchaseId, reason: "error" } }).catch(() => {});
          const m = (error?.message ?? "").slice(0, 80);
          done({ ok: false, reason: "error", ar: `تعذّر إتمام الدفع${m ? ` (${m})` : ""}. لم يتم منح أي شيء.`, en: `Payment could not be completed${m ? ` (${m})` : ""}. Nothing was granted.` });
        },
      },
    );
    } catch (e) {
      api("/payments/cancel", { body: { purchaseId: purchase.purchaseId, reason: "error" } }).catch(() => {});
      done({ ok: false, reason: "error", ar: "تعذّر بدء الدفع من Pi. أعد المحاولة.", en: `Could not start the Pi payment (${e instanceof Error ? e.message.slice(0, 60) : "error"}).` });
    }
  });
}
