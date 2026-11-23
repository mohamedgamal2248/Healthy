"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, rememberToken, getToken } from "@/lib/api";
import { clearGetCache } from "@/lib/useGet";
import { piSignIn } from "@/lib/pi-client";
import { startPiOAuth } from "@/lib/pi-oauth";

export type Lang = "ar" | "en";
export type Balances = { plan: number; pack: number; trial: number; total: number; planExpiresAt: string | null; planActive: boolean };
export type Me = {
  profile: {
    username: string; kyc_verified: boolean; age: number | null; sex: "male" | "female" | null; weight_kg: number | null; height_cm: number | null;
    goal: "lose" | "gain" | "maintain" | null; activity: "low" | "medium" | "high" | null; conditions: string[];
    disclaimer_accepted_at: string | null; language: Lang; timezone: string; leaderboard_visible: boolean;
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
  return !!window.Pi;
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
    refresh();
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
      } catch {}
      router.push(m && !m.profile.disclaimer_accepted_at ? "/profile" : "/today");
    },
    [refresh, router],
  );

  const signIn = useCallback(async () => {
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
