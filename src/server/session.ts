import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionClaims = { u: string; uid: string; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET (32+ chars) is not configured");
  return s;
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest();

/** Compact signed token (HMAC-SHA256). Stateless; carries only the Pi username and uid. */
export function signSession(username: string, uid: string, ttlSec = 60 * 60 * 24 * 30): string {
  const body = b64(JSON.stringify({ u: username, uid, exp: Math.floor(Date.now() / 1000) + ttlSec } satisfies SessionClaims));
  return `${body}.${b64(sign(body))}`;
}

export function verifySession(token: string | null | undefined): SessionClaims | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const expected = sign(body);
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionClaims;
    if (!claims.u || claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch {
    return null;
  }
}
