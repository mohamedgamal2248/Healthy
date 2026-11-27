import { NextResponse } from "next/server";
import { track } from "./telemetry";

export class HttpError extends Error {
  constructor(public status: number, public code: string, public ar: string, public en: string, public extra?: Record<string, unknown>) {
    super(en);
  }
}

export const E = {
  unauth: () => new HttpError(401, "unauthenticated", "سجّل الدخول بحساب Pi أولًا.", "Please sign in with Pi first."),
  kyc: () =>
    new HttpError(403, "kyc_required", "هذه الميزة متاحة فقط لحسابات Pi الموثقة (KYC). أكمل توثيق هويتك في تطبيق Pi ثم حاول مرة أخرى.", "This feature is only available to KYC-verified Pi accounts. Complete KYC in the Pi app and try again."),
  disclaimer: () =>
    new HttpError(403, "disclaimer_required", "يرجى قراءة التنبيه الصحي والموافقة عليه من صفحة الملف الشخصي قبل المتابعة.", "Please read and accept the health disclaimer in your profile first."),
  admin: () => new HttpError(403, "forbidden", "هذه الصفحة للمالك فقط.", "Owner only."),
  notFound: () => new HttpError(404, "not_found", "غير موجود.", "Not found."),
  bad: (ar = "بيانات غير صالحة.", en = "Invalid input.") => new HttpError(400, "bad_request", ar, en),
  noCredits: () =>
    new HttpError(402, "no_credits", "رصيدك من الكريدت انتهى. اشترك في الخطة الشهرية أو اشترِ باقة كريدت.", "You are out of credits. Subscribe to the monthly plan or buy a credit pack."),
  notConfigured: (what = "الخدمة") => new HttpError(503, "not_configured", `${what} غير مُفعّلة حاليًا (الخدمة غير مهيأة).`, "This service is not configured yet."),
  needPlan: () => new HttpError(402, "plan_required", "هذه الميزة للمشتركين في الخطة الشهرية.", "This feature is for monthly plan subscribers."),
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: { code: e.code, ar: e.ar, en: e.en, ...(e.extra ?? {}) } }, { status: e.status });
  }
  // A malformed id in the URL (not a uuid) is the caller's mistake, not a server fault.
  if (e instanceof Error && /invalid input syntax for type (uuid|integer|bigint)/i.test(e.message)) {
    return NextResponse.json({ error: { code: "not_found", ar: "غير موجود.", en: "Not found." } }, { status: 404 });
  }
  console.error("[api] unhandled", e);
  return NextResponse.json(
    { error: { code: "server_error", ar: "حدث خطأ غير متوقع. حاول مرة أخرى.", en: "Unexpected error. Please try again." } },
    { status: 500 },
  );
}

type Ctx<P> = { params: Promise<P> };
/** Wrap a route handler so thrown HttpErrors become clean bilingual JSON errors. */
export function route<P = Record<string, string>>(fn: (req: Request, ctx: Ctx<P>) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>) => {
    const t0 = Date.now();
    let res: Response;
    let err: unknown;
    try {
      res = await fn(req, ctx);
    } catch (e) {
      err = e;
      res = errorResponse(e);
    }
    track(req.url, req.method, res.status, Date.now() - t0, err);
    return res;
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw E.bad();
  }
}
