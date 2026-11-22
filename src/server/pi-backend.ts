// Server-side Pi Platform API client (auth verification + U2A payment approve / complete).
// Shared Pi payment pattern: client creates the payment with the Pi SDK, the server approves it,
// then completes it after verifying the payment with the Pi API. Never trust the client callback alone.
import { HttpError } from "./http";

const PI_API = "https://api.minepi.com/v2";

export type PiMe = { uid: string; username: string; [k: string]: unknown };

export type PiPayment = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata?: Record<string, unknown>;
  direction: string;
  status: { developer_approved: boolean; transaction_verified: boolean; developer_completed: boolean; cancelled: boolean; user_cancelled: boolean };
  transaction: null | { txid: string; verified: boolean; _link?: string };
};

function apiKey(): string {
  const k = process.env.PI_API_KEY;
  if (!k) throw new HttpError(503, "not_configured", "الدفع غير مُفعّل حاليًا (مفتاح Pi غير مضبوط).", "Payments are not configured (PI_API_KEY missing).");
  return k;
}

async function piFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${PI_API}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[pi-api]", path, res.status, text.slice(0, 300));
    throw new HttpError(502, "pi_api_error", "تعذّر الاتصال بخادم Pi. حاول مرة أخرى.", "Could not reach the Pi API. Please retry.");
  }
  return (await res.json()) as T;
}

/** Verify a Pi access token from the client and return the real identity. */
export async function verifyAccessToken(accessToken: string): Promise<PiMe> {
  const res = await fetch(`${PI_API}/me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new HttpError(401, "invalid_pi_token", "فشل التحقق من حساب Pi. أعد تسجيل الدخول.", "Pi sign-in could not be verified. Sign in again.");
  const me = (await res.json()) as PiMe;
  if (!me.uid || !me.username) throw new HttpError(401, "invalid_pi_token", "فشل التحقق من حساب Pi.", "Pi sign-in could not be verified.");
  return me;
}

/**
 * KYC policy. The Pi Platform API does not always expose KYC in /me.
 *  - strict: require an explicit KYC flag in /me (fails closed when absent). Use on Mainnet.
 *  - testnet (default when NEXT_PUBLIC_PI_NETWORK != mainnet): Testnet accounts cannot be KYC-checked,
 *    so every Pi-authenticated user is treated as verified for end-to-end testing.
 */
export function isKycVerified(me: PiMe): boolean {
  const network = process.env.NEXT_PUBLIC_PI_NETWORK ?? "testnet";
  const mode = process.env.PI_KYC_MODE ?? (network === "mainnet" ? "strict" : "testnet");
  if (mode === "testnet") return true;
  const flag = (me as Record<string, unknown>).kyc_verified ?? (me as Record<string, unknown>).kycVerified ?? (me as { credentials?: Record<string, unknown> }).credentials?.kyc_verified;
  return flag === true;
}

export const getPayment = (id: string) => piFetch<PiPayment>(`/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Key ${apiKey()}` } });

export const approvePayment = (id: string) =>
  piFetch<PiPayment>(`/payments/${encodeURIComponent(id)}/approve`, { method: "POST", headers: { Authorization: `Key ${apiKey()}`, "Content-Type": "application/json" }, body: "{}" });

export const completePayment = (id: string, txid: string) =>
  piFetch<PiPayment>(`/payments/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: { Authorization: `Key ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ txid }),
  });
