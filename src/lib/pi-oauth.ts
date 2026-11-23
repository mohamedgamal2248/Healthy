"use client";
// Pi Sign-In (OAuth implicit flow) for people using an ordinary browser instead of Pi Browser.
// The access token comes back in the URL fragment; it is verified by OUR server against the Pi API, never trusted here.

/** Public identifier from the Pi Developer Portal (no secret exists for the implicit flow). */
export const PI_CLIENT_ID = process.env.NEXT_PUBLIC_PI_CLIENT_ID || "zQUUOqrs-cb0TNBrR7pHVeQC_sVIj_iTIPbCPXwXjKc";
const AUTHORIZE = "https://accounts.pinet.com/oauth/authorize";
const STATE_KEY = "healthy.oauth.state";

export const redirectUri = () => `${window.location.origin}/signin/callback`;

function randomState(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Send the browser to Pi to sign in. A random `state` protects against forged callbacks. */
export function startPiOAuth() {
  const state = randomState();
  try { sessionStorage.setItem(STATE_KEY, state); } catch { /* storage blocked: the callback will refuse, which is safe */ }
  const u = new URL(AUTHORIZE);
  u.searchParams.set("response_type", "token");
  u.searchParams.set("client_id", PI_CLIENT_ID);
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("scope", "username");
  u.searchParams.set("state", state);
  window.location.assign(u.toString());
}

export type OAuthResult = { ok: true; accessToken: string } | { ok: false; error: string };

/** Read the callback fragment once, check the state, and remove the token from the address bar. */
export function readOAuthCallback(): OAuthResult {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  history.replaceState(null, "", window.location.pathname);
  let expected: string | null = null;
  try { expected = sessionStorage.getItem(STATE_KEY); sessionStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
  const err = params.get("error");
  if (err) return { ok: false, error: err };
  const token = params.get("access_token");
  if (!token) return { ok: false, error: "missing_token" };
  if (!expected || params.get("state") !== expected) return { ok: false, error: "state_mismatch" };
  return { ok: true, accessToken: token };
}
