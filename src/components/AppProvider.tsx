"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, rememberToken, getToken } from "@/lib/api";
import { clearGetCache, prefetchRoute } from "@/lib/useGet";
import { canUsePiSdk, inPiContext, piSignIn } from "@/lib/pi-client";
import { isAndroidChrome, piBrowserUrl } from "@/lib/pi-handoff";
import { startPiOAuth } from "@/lib/pi-oauth";

export type Lang = "ar" | "en";
export type Balances = { plan: number; pack: number; trial: number; total: number; planExpiresAt: string | null; planActive: boolean };
export type Me = {
  profile: {
    username: string; kyc_verified: boolean; age: number | null; sex: "male" | "female" | null; weight_kg: number | null; height_cm: number | null;
    goal: "lose" | "gain" | "maintain" | null; activity: "low" | "medium" | "high" | null; conditions: string[];
    disclaimer_accepted_at: string | null; language: Lang; timezone: string; leaderboard_visible: boolean; notify_pi?: boolean; notify_news?: boolean; notify_events?: boolean; plan_autolog?: boolean; reminder_hour?: number;
    weight_date?: string | null; plan_premium?: boolean; allergies?: string[]; dislikes?: string | null; equipment?: string[]; fitness_level?: "beginner" | "intermediate" | "advanced" | null; avoid_joints?: string[]; household?: number | null;
  };
  balances: Balances | null;
  isAdmin: boolean;
};
type Toast = { id: number; msg: string; kind: "ok" | "err" };

type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  tr: (ar: string, en: string) => string;
  me: Me | null;
  ready: boolean;
  refresh: () => Promise<Me | null>;
  signIn: () => Promise<void>;
  devSignIn: (username: string, kyc: boolean) => Promise<void>;
  signOut: () => void;
  /** Finish a Pi Sign-In (OAuth) started in an ordinary browser. Returns false if the server refused the token. */
  signInWithToken: (accessToken: string) => Promise<boolean>;
  signingIn: boolean;
  toast: (msg: string, kind?: "ok" | "err") => void;
  errMsg: (e: unknown) => string;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("AppProvider missing");
  return c;
};

const waitForPi = async (ms = 4000) => {
  const t0 = Date.now();
  while (!window.Pi && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 150));
  return canUsePiSdk();
};

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>("en"); // English is the primary language
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    try {
      const l = localStorage.getItem("healthy.lang");
      if (l === "ar" || l === "en") setLangState(l);
    } catch {}
  }, []);
  // Invite links look like /?ref=username: remember the inviter until the user signs in.
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9_.@-]{3,33}$/.test(ref)) localStorage.setItem("healthy.ref", ref);
      const duo = new URLSearchParams(window.location.search).get("duo");
      if (duo && /^[A-Za-z0-9]{6,24}$/.test(duo)) localStorage.setItem("healthy.duo", duo);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const tr = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const errMsg = useCallback((e: unknown) => (e instanceof ApiError ? (lang === "ar" ? e.ar : e.en) : lang === "ar" ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again."), [lang]);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setReady(true);
      return null;
    }
    try {
      const m = await api<Me>("/me");
      setMe(m);
      try {
        if (!localStorage.getItem("healthy.lang") && (m.profile.language === "ar" || m.profile.language === "en")) setLangState(m.profile.language);
      } catch {}
      setReady(true);
      return m;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        rememberToken(null);
        clearGetCache();
        setMe(null);
      }
      setReady(true);
      return null;
    }
  }, []);

  useEffect(() => {
    const out = () => { clearGetCache(); setMe(null); setReady(true); };
    window.addEventListener("healthy:signedout", out);
    return () => window.removeEventListener("healthy:signedout", out);
  }, []);

  useEffect(() => {
    if (getToken()) prefetchRoute(window.location.pathname); // page data loads while /me does
    refresh();
  }, [refresh]);

  // Coming back from Pi Browser (after a payment there) the credits changed on the server: refresh when the tab is visible again.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && getToken()) { clearGetCache(); refresh(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const afterLogin = useCallback(
    async (token: string) => {
      clearGetCache();
      rememberToken(token);
      const m = await refresh();
      try {
        const ref = localStorage.getItem("healthy.ref");
        if (ref) {
          localStorage.removeItem("healthy.ref");
          await api("/referral", { body: { ref } }).catch(() => {});
        }
        const duo = localStorage.getItem("healthy.duo");
        if (duo) {
          localStorage.removeItem("healthy.duo");
          const r = await api<{ joined: boolean }>("/duo/join", { body: { code: duo } }).catch(() => null);
          if (r?.joined) toast(tr("انضممت إلى تحدي صديقك لمدة 7 أيام", "You joined your friend's 7-day challenge"), "ok");
        }
      } catch {}
      // Coming from "Continue in Pi Browser" with a purchase waiting: stay on the pricing page so it can open.
      const keep = window.location.pathname === "/pricing" && new URLSearchParams(window.location.search).get("buy");
      router.push(keep ? window.location.pathname + window.location.search : "/today"); // value first: challenges work right away; the profile is one tap away on Today
    },
    [refresh, router, toast, tr],
  );

  const signIn = useCallback(async () => {
    // Plain Chrome on Android hands Pi's OAuth page straight to the Pi Browser app, which cannot load it ("Something
    // went wrong"). So continue directly in Pi Browser, where the Pi SDK signs the user in. Must run inside the tap.
    if (!inPiContext() && isAndroidChrome()) {
      window.location.href = piBrowserUrl(window.location.pathname === "/" ? "/" : window.location.pathname + window.location.search);
      return;
    }
    setSigningIn(true);
    try {
      if (!(await waitForPi())) {
        // Ordinary browser: use Pi Sign-In (OAuth). Pi asks the user to confirm in Pi Browser, then returns here.
        startPiOAuth();
        return;
      }
      const accessToken = await piSignIn();
      const r = await api<{ token: string }>("/auth/pi", { body: { accessToken } });
      await afterLogin(r.token);
    } catch (e) {
      toast(e instanceof ApiError ? errMsg(e) : tr("تعذّر تسجيل الدخول بحساب Pi.", "Pi sign-in failed."), "err");
    } finally {
      setSigningIn(false);
    }
  }, [afterLogin, errMsg, toast, tr]);

  const signInWithToken = useCallback(
    async (accessToken: string) => {
      try {
        const r = await api<{ token: string }>("/auth/pi", { body: { accessToken } });
        await afterLogin(r.token);
        return true;
      } catch (e) {
        toast(e instanceof ApiError ? errMsg(e) : tr("تعذّر تسجيل الدخول بحساب Pi.", "Pi sign-in failed."), "err");
        return false;
      }
    },
    [afterLogin, errMsg, toast, tr],
  );

  const devSignIn = useCallback(
    async (username: string, kyc: boolean) => {
      try {
        const r = await api<{ token: string }>("/auth/dev", { body: { username, kyc } });
        await afterLogin(r.token);
      } catch (e) {
        toast(errMsg(e), "err");
      }
    },
    [afterLogin, errMsg, toast],
  );

  const signOut = useCallback(() => {
    if (getToken()) api("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    clearGetCache();
    rememberToken(null);
    setMe(null);
    router.push("/");
  }, [router]);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      try {
        localStorage.setItem("healthy.lang", l);
      } catch {}
      if (getToken()) api("/me", { method: "PATCH", body: { language: l } }).catch(() => {});
    },
    [],
  );

  const value = useMemo<Ctx>(
    () => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, tr, me, ready, refresh, signIn, devSignIn, signOut, signInWithToken, signingIn, toast, errMsg }),
    [lang, setLang, tr, me, ready, refresh, signIn, devSignIn, signOut, signInWithToken, signingIn, toast, errMsg],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`pop pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg ${t.kind === "ok" ? "bg-brand-800" : "bg-rose-600"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}
