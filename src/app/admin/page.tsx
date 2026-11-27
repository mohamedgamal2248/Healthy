"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import { Field, Gate, Notice, PageHeader, PageSkeleton, Sheet, Spinner } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { INGREDIENTS, MEAL_TAGS } from "@/data/ingredients";

type Ch = { id: string; type: string; title_ar: string; title_en: string; target_value: number | null; unit: string | null; active: boolean };
type Meal = { id: string; meal_type: "breakfast" | "lunch" | "dinner"; name_ar: string; name_en: string; photo_url: string | null; time_min: number; calories: number; protein_g: number; cost_egp: number; why_ar: string; why_en: string; tags: string[]; ingredients: { item: string; qty: string; key?: string }[]; steps: string[]; active: boolean };
type KindCost = { kind: string; n: number; refunded: number; avgCost: number; totalCost: number; avgIn: number; avgOut: number; avgSearches: number };
type Stats = { aiByKind: KindCost[]; aiCostUsd: number; avgCostUsd: number; aiCalls: number; aiRefunded: number; audit: { admin: string; action: string; target: string | null; created_at: string }[]; users: number; challengesCompleted: number; recipesGenerated: number; plansActive: number; piReceived: number };

function Inner() {
  const { me, tr, toast, errMsg } = useApp();
  const [tab, setTab] = useState<"stats" | "users" | "monitor" | "challenges" | "meals" | "rotation" | "group" | "notify">("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [chs, setChs] = useState<Ch[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [s, c, m] = await Promise.all([api<Stats>("/admin/stats"), api<{ challenges: Ch[] }>("/admin/challenges"), api<{ meals: Meal[] }>("/admin/meals")]);
      setStats(s); setChs(c.challenges); setMeals(m.meals);
    } catch (e) { toast(errMsg(e), "err"); }
  }, [toast, errMsg]);
  useEffect(() => { if (me?.isAdmin) load(); }, [me, load]);
  if (!me?.isAdmin) return <div className="mx-auto mt-6 max-w-md"><Notice tone="bad">{tr("هذه الصفحة للمالك فقط.", "Owner only.")}</Notice></div>;
  if (!stats) return <PageSkeleton />;

  const post = async (path: string, body: unknown, okMsg = tr("تم الحفظ", "Saved")) => { setBusy(true); try { await api(path, { body }); toast(okMsg, "ok"); await load(); return true; } catch (e) { toast(errMsg(e), "err"); return false; } finally { setBusy(false); } };

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-5">
      <PageHeader title={tr("لوحة الإدارة", "Admin")} sub={tr("أدوات المحتوى والإجماليات وإحصاءات الاستخدام. لا تُعرض ملفات صحية فردية.", "Content tools, totals and usage statistics. No individual health profiles are shown.")} />
      <div className="flex flex-wrap gap-2">{([["stats", tr("الإجماليات", "Totals")], ["users", tr("المستخدمون", "Users")], ["monitor", tr("المراقبة", "Monitor")], ["challenges", tr("التحديات", "Challenges")], ["meals", tr("الوجبات", "Meals")], ["rotation", tr("وجبات اليوم", "Daily rotation")], ["group", tr("تحدي الأسبوع", "Weekly challenge")], ["notify", tr("الإشعارات", "Notifications")]] as const).map(([k, l]) => (<button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>))}</div>

      {tab === "stats" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[["users", tr("المستخدمون", "Users"), stats.users], ["check", tr("تحديات منجزة", "Challenges completed"), stats.challengesCompleted], ["chef", tr("وصفات AI", "Recipes generated"), stats.recipesGenerated], ["sparkles", tr("خطط فعّالة", "Plans active"), stats.plansActive], ["pi", tr("Pi المستلمة", "Pi received"), stats.piReceived]].map(([ic, l, v]) => (
              ic === "users" ? (
                <button key={l as string} type="button" onClick={() => setTab("users")} className="card text-start transition hover:shadow-md" aria-label={tr("عرض جدول المستخدمين", "Show the users table")}><Icon name={ic as string} size={22} className="text-brand-600" /><p className="mt-2 text-3xl font-extrabold tabular-nums">{v as number}</p><p className="muted">{l as string} · <span className="font-extrabold text-brand-700">{tr("عرض الجدول", "View table")}</span></p></button>
              ) : (
                <div key={l as string} className="card"><Icon name={ic as string} size={22} className="text-brand-600" /><p className="mt-2 text-3xl font-extrabold tabular-nums">{v as number}</p><p className="muted">{l as string}</p></div>
              )
            ))}
          </div>
          <section className="card space-y-3">
            <div className="flex items-center justify-between gap-3"><h2 className="h2">{tr("تكلفة الذكاء الاصطناعي لكل نوع", "AI cost by request type")}</h2><span className="muted tabular-nums">{tr("الإجمالي", "Total")}: ${stats.aiCostUsd} · {stats.aiCalls} {tr("طلب", "calls")} · {stats.aiRefunded} {tr("مُسترد", "refunded")}</span></div>
            <p className="muted">{tr("تقدير من التوكنات الفعلية حسب أسعار Meta (إدخال 0.10 / إخراج 0.50 دولار لكل مليون، وبحث 0.0025). سعر الكريدت للمستخدم نحو 0.05 دولار.", "Estimated from real token usage at Meta's rates ($0.10 in / $0.50 out per 1M, $0.0025 per search). A credit sells for about $0.05.")}</p>
            {stats.aiByKind.length === 0 ? <p className="muted">{tr("لا توجد بيانات بعد.", "No data yet.")}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead><tr className="text-start text-xs font-extrabold text-ink-soft"><th className="py-2 text-start">{tr("النوع", "Type")}</th><th>{tr("العدد", "Calls")}</th><th>{tr("متوسط التكلفة", "Avg cost")}</th><th>{tr("إدخال/إخراج", "Tokens in/out")}</th><th>{tr("نسبة من السعر", "% of price")}</th></tr></thead>
                  <tbody>
                    {stats.aiByKind.map((k) => {
                      const pct = (k.avgCost / 0.05) * 100;
                      const high = k.avgCost > 0.01;
                      return (
                        <tr key={k.kind} className="border-t border-line text-center">
                          <td className="py-2.5 text-start font-extrabold">{({ recipe: tr("وجبة", "Meal"), workout: tr("تمرين", "Workout"), challenge: tr("تحدٍّ", "Challenge"), scan: tr("تحليل صورة", "Photo scan"), fridge: tr("من التلاجة", "From fridge"), chat: tr("محادثة", "Chat"), plan: tr("خطة", "Plan") } as Record<string, string>)[k.kind] ?? k.kind}</td>
                          <td className="tabular-nums">{k.n}{k.refunded ? <span className="text-xs text-ink-soft"> ({k.refunded} {tr("مُسترد", "refunded")})</span> : null}</td>
                          <td className={`font-extrabold tabular-nums ${high ? "text-rose-600" : ""}`}>${k.avgCost.toFixed(5)}</td>
                          <td className="tabular-nums text-ink-soft">{k.avgIn} / {k.avgOut}</td>
                          <td className={`tabular-nums ${high ? "font-extrabold text-rose-600" : ""}`}>{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {stats.aiByKind.some((k) => k.avgCost > 0.01) && <Notice tone="warn">{tr("متوسط تكلفة أحد الأنواع تجاوز 0.01 دولار: فكّر في رفع كريدته إلى 2.", "One type averages above $0.01 per call: consider charging 2 credits for it.")}</Notice>}
          </section>
          <section className="card space-y-2">
            <h2 className="h2">{tr("سجل أفعال الإدارة", "Admin audit log")}</h2>
            {stats.audit.length === 0 ? <p className="muted">{tr("لا توجد أفعال بعد.", "Nothing yet.")}</p> : (
              <ul className="divide-y divide-line text-sm">{stats.audit.map((a, i) => (<li key={i} className="flex flex-wrap items-center gap-x-3 py-2"><span className="font-extrabold">{a.action}</span><span className="text-ink-soft" dir="ltr">{a.target}</span><span className="ms-auto text-xs text-ink-soft" dir="ltr">{a.admin} · {new Date(a.created_at).toLocaleString()}</span></li>))}</ul>
            )}
          </section>
        </>
      )}
      {tab === "users" && <UsersAdmin />}
      {tab === "monitor" && <MonitorAdmin />}
      {tab === "challenges" && <ChallengeAdmin items={chs} onSave={(c) => post("/admin/challenges", c)} busy={busy} />}
      {tab === "meals" && <MealAdmin items={meals} onSave={(m) => post("/admin/meals", m)} busy={busy} />}
      {tab === "rotation" && <Rotation meals={meals} onSave={(b) => post("/admin/rotation", b)} busy={busy} />}
      {tab === "notify" && <div className="space-y-5"><BroadcastAdmin /><NotifyAdmin /></div>}
      {tab === "group" && <GroupAdmin chs={chs} onSave={(b) => post("/admin/group", b)} busy={busy} />}
    </div>
  );
}

function ChallengeAdmin({ items, onSave, busy }: { items: Ch[]; onSave: (c: Ch) => Promise<boolean>; busy: boolean }) {
  const { tr } = useApp();
  const empty: Ch = { id: "", type: "water", title_ar: "", title_en: "", target_value: null, unit: null, active: true };
  const [f, setF] = useState<Ch>(empty);
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="h2">{tr("إضافة / تعديل تحدٍّ", "Add / edit challenge")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID (a-z, 0-9, -)"><input className="field" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} /></Field>
          <Field label={tr("النوع", "Type")}><input className="field" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} /></Field>
          <Field label="العنوان بالعربية"><input className="field" value={f.title_ar} onChange={(e) => setF({ ...f, title_ar: e.target.value })} /></Field>
          <Field label="English title"><input className="field" value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></Field>
          <Field label={tr("القيمة المستهدفة", "Target value")}><input className="field" type="number" value={f.target_value ?? ""} onChange={(e) => setF({ ...f, target_value: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label={tr("الوحدة", "Unit")}><input className="field" value={f.unit ?? ""} onChange={(e) => setF({ ...f, unit: e.target.value || null })} /></Field>
        </div>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />{tr("مفعّل", "Active")}</label>
        <button className="btn-primary" disabled={busy} onClick={async () => { if (await onSave(f)) setF(empty); }}>{busy ? <Spinner size={18} /> : <Icon name="check" />}{tr("حفظ", "Save")}</button>
      </div>
      <ul className="space-y-2">{items.map((c) => (
        <li key={c.id} className="card flex items-center gap-3 !p-3"><div className="min-w-0 flex-1"><p className={`font-extrabold ${c.active ? "" : "text-ink-soft line-through"}`}>{c.title_ar}</p><p className="muted">{c.id} · {c.type}</p></div>
          <button className="btn-ghost btn-sm" onClick={() => setF(c)} aria-label="edit"><Icon name="edit" size={18} /></button>
          <button className="btn-soft btn-sm" onClick={() => onSave({ ...c, active: !c.active })}>{c.active ? tr("إيقاف", "Deactivate") : tr("تفعيل", "Activate")}</button></li>))}</ul>
    </div>
  );
}

function MealAdmin({ items, onSave, busy }: { items: Meal[]; onSave: (m: Meal) => Promise<boolean>; busy: boolean }) {
  const { tr, toast } = useApp();
  const empty: Meal = { id: "", meal_type: "lunch", name_ar: "", name_en: "", photo_url: null, time_min: 20, calories: 400, protein_g: 20, cost_egp: 30, why_ar: "", why_en: "", tags: [], ingredients: [], steps: [], active: true };
  const [f, setF] = useState<Meal>(empty);
  const [ing, setIng] = useState("");
  const [steps, setSteps] = useState("");
  const edit = (m: Meal) => { setF(m); setIng(m.ingredients.map((i) => `${i.item} | ${i.qty} | ${i.key ?? ""}`).join("\n")); setSteps(m.steps.join("\n")); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const keys = INGREDIENTS.map((i) => i.key).join(", ");
  const submit = async () => {
    const ingredients = ing.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [item, qty, key] = l.split("|").map((s) => s.trim()); return { item, qty: qty || "-", ...(key ? { key } : {}) }; });
    const st = steps.split("\n").map((s) => s.trim()).filter(Boolean);
    if (await onSave({ ...f, ingredients, steps: st })) { setF(empty); setIng(""); setSteps(""); } else toast(tr("راجع الحقول", "Check the fields"), "err");
  };
  const n = (k: keyof Meal) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="h2">{tr("إضافة / تعديل وجبة", "Add / edit meal")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID"><input className="field" value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} /></Field>
          <Field label={tr("النوع", "Type")}><select className="field" value={f.meal_type} onChange={(e) => setF({ ...f, meal_type: e.target.value as Meal["meal_type"] })}><option value="breakfast">breakfast</option><option value="lunch">lunch</option><option value="dinner">dinner</option></select></Field>
          <Field label="الاسم بالعربية"><input className="field" value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></Field>
          <Field label="English name"><input className="field" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></Field>
          <Field label={tr("دقائق التحضير", "Prep minutes")}><input className="field" type="number" value={f.time_min} onChange={n("time_min")} /></Field>
          <Field label={tr("السعرات", "Calories")}><input className="field" type="number" value={f.calories} onChange={n("calories")} /></Field>
          <Field label={tr("بروتين (جم)", "Protein (g)")}><input className="field" type="number" value={f.protein_g} onChange={n("protein_g")} /></Field>
          <Field label={tr("التكلفة (جنيه)", "Cost (EGP)")}><input className="field" type="number" value={f.cost_egp} onChange={n("cost_egp")} /></Field>
        </div>
        <Field label="لماذا هي صحية (عربي)"><input className="field" value={f.why_ar} onChange={(e) => setF({ ...f, why_ar: e.target.value })} /></Field>
        <Field label="Why it's healthy (English)"><input className="field" value={f.why_en} onChange={(e) => setF({ ...f, why_en: e.target.value })} /></Field>
        <div><span className="label">{tr("الوسوم", "Tags")}</span><div className="flex flex-wrap gap-2">{MEAL_TAGS.map((t) => (<button key={t.key} type="button" className="chip" aria-pressed={f.tags.includes(t.key)} onClick={() => setF({ ...f, tags: f.tags.includes(t.key) ? f.tags.filter((x) => x !== t.key) : [...f.tags, t.key] })}>{tr(t.ar, t.en)}</button>))}</div></div>
        <Field label={tr("المكونات (سطر لكل مكوّن: الاسم | الكمية | مفتاح اختياري)", "Ingredients (one per line: name | qty | optional key)")} hint={keys}><textarea className="field !min-h-28 py-3" value={ing} onChange={(e) => setIng(e.target.value)} /></Field>
        <Field label={tr("الخطوات (سطر لكل خطوة)", "Steps (one per line)")}><textarea className="field !min-h-28 py-3" value={steps} onChange={(e) => setSteps(e.target.value)} /></Field>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />{tr("مفعّلة", "Active")}</label>
        <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? <Spinner size={18} /> : <Icon name="check" />}{tr("حفظ", "Save")}</button>
      </div>
      <ul className="space-y-2">{items.map((m) => (
        <li key={m.id} className="card flex items-center gap-3 !p-3"><div className="min-w-0 flex-1"><p className={`truncate font-extrabold ${m.active ? "" : "text-ink-soft line-through"}`}>{m.name_ar}</p><p className="muted">{m.meal_type} · {m.calories} kcal</p></div>
          <button className="btn-ghost btn-sm" onClick={() => edit(m)} aria-label="edit"><Icon name="edit" size={18} /></button>
          <button className="btn-soft btn-sm" onClick={() => onSave({ ...m, active: !m.active })}>{m.active ? tr("إيقاف", "Deactivate") : tr("تفعيل", "Activate")}</button></li>))}</ul>
    </div>
  );
}

function Rotation({ meals, onSave, busy }: { meals: Meal[]; onSave: (b: unknown) => Promise<boolean>; busy: boolean }) {
  const { tr } = useApp();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<Meal["meal_type"]>("breakfast");
  const [mealId, setMealId] = useState("");
  return (
    <div className="card space-y-3">
      <h2 className="h2">{tr("تعديل وجبة يوم معيّن", "Override a day's meal")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={tr("التاريخ", "Date")}><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={tr("النوع", "Type")}><select className="field" value={type} onChange={(e) => { setType(e.target.value as Meal["meal_type"]); setMealId(""); }}><option value="breakfast">breakfast</option><option value="lunch">lunch</option><option value="dinner">dinner</option></select></Field>
        <Field label={tr("الوجبة", "Meal")}><select className="field" value={mealId} onChange={(e) => setMealId(e.target.value)}><option value="">{tr("— بدون تعديل (إلغاء) —", "— none (clear override) —")}</option>{meals.filter((m) => m.meal_type === type && m.active).map((m) => (<option key={m.id} value={m.id}>{m.name_ar}</option>))}</select></Field>
      </div>
      <button className="btn-primary" disabled={busy} onClick={() => onSave({ date, meal_type: type, meal_id: mealId || null })}><Icon name="check" />{tr("حفظ", "Save")}</button>
    </div>
  );
}

function GroupAdmin({ chs, onSave, busy }: { chs: Ch[]; onSave: (b: unknown) => Promise<boolean>; busy: boolean }) {
  const { tr } = useApp();
  const [week, setWeek] = useState(new Date().toISOString().slice(0, 10));
  const [cid, setCid] = useState("");
  const [ar, setAr] = useState("");
  const [en, setEn] = useState("");
  return (
    <div className="card space-y-3">
      <h2 className="h2">{tr("إنشاء تحدي الأسبوع الجماعي", "Create the weekly group challenge")}</h2>
      <Notice tone="info">{tr("ترتيب وشارات فقط: لا رسوم دخول ولا جوائز بعملة Pi.", "Ranking and badges only: no entry fee and no Pi prizes.")}</Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr("أي يوم داخل الأسبوع", "Any date in the week")}><input type="date" className="field" value={week} onChange={(e) => setWeek(e.target.value)} /></Field>
        <Field label={tr("تحدٍّ مرتبط (اختياري)", "Linked challenge (optional)")}><select className="field" value={cid} onChange={(e) => setCid(e.target.value)}><option value="">—</option>{chs.map((c) => (<option key={c.id} value={c.id}>{c.title_ar}</option>))}</select></Field>
        <Field label="العنوان بالعربية"><input className="field" value={ar} onChange={(e) => setAr(e.target.value)} /></Field>
        <Field label="English title"><input className="field" value={en} onChange={(e) => setEn(e.target.value)} /></Field>
      </div>
      <button className="btn-primary" disabled={busy || !ar || !en} onClick={() => onSave({ week_start: week, challenge_id: cid || null, title_ar: ar, title_en: en })}><Icon name="check" />{tr("حفظ", "Save")}</button>
    </div>
  );
}

export default function AdminPage() { return <Gate><Inner /></Gate>; }

type NotifyResult = { pi: { requested: number; delivered: number; error?: string }; push: { configured: boolean; devices: number; sent: number; removed: number; failed: number; statuses?: (number | string)[] } };


type Broadcast = { id: string; audience: string; mode: string; send_at: string | null; local_date: string | null; local_hour: number | null; title_ar: string | null; body_ar: string | null; title_en: string | null; body_en: string | null; recipients: number; pi_requested: number; pi_delivered: number; push_devices: number; push_sent: number; opened: number; status: string; created_at: string };
type Preview = { people: number; pi: number; devices: number; truncated: boolean };
type Overview = { broadcasts: Broadcast[]; summary: { kind: string; sent: number; opened: number }[]; countries: string[] };

const TEMPLATES: { key: string; ar: string; en: string; t: { title_ar: string; body_ar: string; title_en: string; body_en: string; subroute: string } }[] = [
  { key: "daily", ar: "تذكير يومي", en: "Daily reminder", t: { title_ar: "تحدّي اليوم في انتظارك", body_ar: "خمس دقائق تكفي. افتح Healthy وسجّل وجبتك وأنجز تحدّي اليوم.", title_en: "Today's challenge is waiting", body_en: "Five minutes is enough. Open Healthy, log a meal and finish today's challenge.", subroute: "/today" } },
  { key: "meal", ar: "وجبة اليوم", en: "Meal idea", t: { title_ar: "وجبة صحية لليوم", body_ar: "اكتشف وجبات جديدة قليلة السعرات من مكونات بسيطة في كتالوج Healthy.", title_en: "A healthy meal idea for today", body_en: "Discover new low-calorie meals from simple ingredients in the Healthy catalogue.", subroute: "/meals" } },
  { key: "water", ar: "الماء", en: "Water", t: { title_ar: "هل شربت ماءً اليوم؟", body_ar: "كوب ماء الآن يساعدك على الاستمرار. سجّل عاداتك اليوم في Healthy.", title_en: "Have you had water today?", body_en: "A glass of water now helps you keep going. Log your habits in Healthy today.", subroute: "/today" } },
  { key: "comeback", ar: "عودة", en: "Come back", t: { title_ar: "اشتقنا لك", body_ar: "خطتك وتحدّياتك في انتظارك. ارجع وكمّل من حيث توقفت.", title_en: "We miss you", body_en: "Your plan and challenges are waiting. Come back and pick up where you left off.", subroute: "/today" } },
];

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, "0")}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`);
const KIND_AR: Record<string, [string, string]> = { reminder: ["التذكير اليومي", "Daily reminder"], expiry: ["قرب انتهاء الخطة", "Plan ending"], broadcast: ["إعلانات المالك", "Announcements"], event: ["تهنئة بالإنجازات", "Achievement notices"] };

/** Owner-only: write one announcement, choose who gets it and when, review, then send or schedule. Everyone reads it in their own language. */
function BroadcastAdmin() {
  const { tr, toast, errMsg, lang } = useApp();
  const [f, setF] = useState({ title_ar: "", body_ar: "", title_en: "", body_en: "", audience: "all", subroute: "/today" });
  const [when, setWhen] = useState<"now" | "local" | "at">("now");
  const [localDate, setLocalDate] = useState(() => new Date(Date.now() + 86400_000).toISOString().slice(0, 10));
  const [localHour, setLocalHour] = useState(17);
  const [atValue, setAtValue] = useState("");
  const [id, setId] = useState(newId);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const load = useCallback(() => { api<Overview>("/admin/broadcast").then(setOv).catch(() => setOv({ broadcasts: [], summary: [], countries: [] })); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setDone(null); };
  const hasText = (f.title_ar.trim() && f.body_ar.trim()) || (f.title_en.trim() && f.body_en.trim());
  const scheduleOk = when === "now" || (when === "local" ? !!localDate : !!atValue && new Date(atValue).getTime() > Date.now());
  const countryName = (c: string) => { try { return new Intl.DisplayNames([lang], { type: "region" }).of(c) ?? c; } catch { return c; } };
  const audiences: [string, string][] = [
    ["all", tr("كل المستخدمين", "All users")], ["active7", tr("نشطون آخر 7 أيام", "Active in the last 7 days")], ["inactive3", tr("غائبون 3 أيام أو أكثر", "Away for 3+ days")], ["inactive7", tr("غائبون 7 أيام أو أكثر", "Away for 7+ days")],
    ["paying", tr("دفعوا Pi", "Paid with Pi")], ["unpaid", tr("لم يدفعوا بعد", "Never paid")], ["ar", tr("مستخدمو العربية", "Arabic users")], ["en", tr("مستخدمو الإنجليزية", "English users")],
    ...((ov?.countries ?? []).map((c) => [`country:${c}`, `${tr("دولة", "Country")}: ${countryName(c)}`] as [string, string])),
  ];
  const targets: [string, string][] = [["/today", tr("اليوم", "Today")], ["/plan", tr("الخطة", "Plan")], ["/meals", tr("الوجبات", "Meals")], ["/diary", tr("اليوميات", "Diary")], ["/progress", tr("تقدّمي", "Progress")], ["/community", tr("المجتمع", "Community")]];
  const audName = (k: string) => audiences.find((a) => a[0] === k)?.[1] ?? (k.startsWith("country:") ? `${tr("دولة", "Country")}: ${countryName(k.slice(8))}` : k);
  const preview = async () => {
    setBusy(true);
    try { setPrev(await api<Preview>("/admin/broadcast", { body: { action: "preview", audience: f.audience, subroute: f.subroute, title_ar: f.title_ar, body_ar: f.body_ar, title_en: f.title_en, body_en: f.body_en } })); } catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const send = async () => {
    setBusy(true);
    try {
      const sched = when === "at" ? { mode: "at", send_at: new Date(atValue).toISOString() } : when === "local" ? { mode: "local", local_date: localDate, local_hour: localHour } : { mode: "now" };
      const r = await api<{ scheduled: boolean; people?: number; recipients?: number; pi_delivered?: number; push_sent?: number }>("/admin/broadcast", { body: { action: "send", id, ...f, ...sched } });
      setDone(r.scheduled ? tr("تمت الجدولة. يُرسل تلقائيًا في الوقت المحدد.", "Scheduled. It will go out automatically at the chosen time.") : tr(`تم. وصل ${r.recipients} مستخدم (Pi: ${r.pi_delivered}، متصفح: ${r.push_sent}).`, `Done. ${r.recipients} users reached (Pi: ${r.pi_delivered}, browser: ${r.push_sent}).`));
      setPrev(null); setId(newId()); load();
      toast(r.scheduled ? tr("تمت الجدولة.", "Scheduled.") : tr("تم إرسال الإشعار.", "Announcement sent."), "ok");
    } catch (e) { toast(errMsg(e), "err"); setPrev(null); load(); } finally { setBusy(false); }
  };
  const cancel = async (bid: string) => {
    try { await api("/admin/broadcast", { body: { action: "cancel", id: bid } }); toast(tr("تم الإلغاء.", "Cancelled."), "ok"); load(); } catch (e) { toast(errMsg(e), "err"); }
  };
  const statusLabel = (b: Broadcast) => b.status === "scheduled" ? (b.mode === "local" ? tr(`مجدول ${b.local_date} ${String(b.local_hour).padStart(2, "0")}:00 بتوقيت كل مستخدم`, `Scheduled ${b.local_date} ${String(b.local_hour).padStart(2, "0")}:00 in each user's time`) : tr(`مجدول ${b.send_at ? new Date(b.send_at).toLocaleString() : ""}`, `Scheduled ${b.send_at ? new Date(b.send_at).toLocaleString() : ""}`)) : b.status === "done" ? tr("تم", "Done") : b.status === "cancelled" ? tr("أُلغي", "Cancelled") : b.status === "failed" ? tr("فشل", "Failed") : tr("قيد الإرسال", "Sending");
  return (
    <div className="space-y-5">
      {ov && ov.summary.length > 0 && (
        <section className="card space-y-3">
          <h2 className="h2">{tr("فعالية الإشعارات (آخر 14 يومًا)", "Notification performance (last 14 days)")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr className="text-xs font-extrabold text-ink-soft"><th className="py-2 text-start">{tr("النوع", "Type")}</th><th>{tr("أُرسل", "Sent")}</th><th>{tr("فتحوا التطبيق خلال 24 س", "Opened within 24 h")}</th><th>{tr("النسبة", "Rate")}</th></tr></thead>
              <tbody>{ov.summary.map((k) => (<tr key={k.kind} className="border-t border-line text-center"><td className="py-2 text-start font-extrabold">{KIND_AR[k.kind] ? tr(KIND_AR[k.kind][0], KIND_AR[k.kind][1]) : k.kind}</td><td className="tabular-nums">{k.sent}</td><td className="tabular-nums">{k.opened}</td><td className="tabular-nums font-extrabold">{pct(k.opened, k.sent)}</td></tr>))}</tbody>
            </table>
          </div>
          <p className="muted">{tr("\"فتح التطبيق\" يعني أن المستخدم دخل التطبيق خلال 24 ساعة من وصول الإشعار. قد يكون فتحه لسبب آخر، فالرقم مؤشر وليس إثباتًا. \"أُرسل\" يعني طُلب إرساله، وPi تسلّم فقط لمن سمح بالإشعارات.", "\"Opened\" means the user opened the app within 24 hours after the notification. They may have opened it anyway, so treat it as an indicator, not proof. \"Sent\" means it was requested; Pi delivers only to people who allow notifications.")}</p>
        </section>
      )}
      <section className="card space-y-4">
        <h2 className="h2">{tr("إرسال إشعار للمستخدمين", "Send an announcement")}</h2>
        <p className="muted">{tr("اختر قالبًا أو اكتب نصك. كل مستخدم يستلم نصه بلغته، ولو كتبت لغة واحدة تصل للجميع بها. لا يصل إلا لمن فعّل «أخبار وعروض Healthy». لن يُرسل شيء قبل أن تراجع وتؤكد.", "Pick a template or write your own. Each user gets it in their own language; if you write only one language everyone gets that one. It only reaches people who left Healthy news on. Nothing is sent until you review and confirm.")}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr("قوالب", "Templates")}>
          {TEMPLATES.map((t) => (<button key={t.key} className="chip" onClick={() => { setF((x) => ({ ...x, ...t.t })); setDone(null); }}>{tr(t.ar, t.en)}</button>))}
          <button className="chip" onClick={() => { setF((x) => ({ ...x, title_ar: "", body_ar: "", title_en: "", body_en: "" })); setDone(null); }}>{tr("مسح", "Clear")}</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3">
            <Field label={tr("العنوان (عربي)", "Title (Arabic)")}><input className="field" dir="rtl" maxLength={60} value={f.title_ar} onChange={(e) => set("title_ar", e.target.value)} /></Field>
            <Field label={tr("الرسالة (عربي)", "Message (Arabic)")}><textarea className="field" dir="rtl" rows={3} maxLength={160} value={f.body_ar} onChange={(e) => set("body_ar", e.target.value)} /><span className="muted tabular-nums">{f.body_ar.length}/160</span></Field>
          </div>
          <div className="space-y-3">
            <Field label={tr("العنوان (إنجليزي)", "Title (English)")}><input className="field" dir="ltr" maxLength={60} value={f.title_en} onChange={(e) => set("title_en", e.target.value)} /></Field>
            <Field label={tr("الرسالة (إنجليزي)", "Message (English)")}><textarea className="field" dir="ltr" rows={3} maxLength={160} value={f.body_en} onChange={(e) => set("body_en", e.target.value)} /><span className="muted tabular-nums">{f.body_en.length}/160</span></Field>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={tr("المستلمون", "Audience")}><select className="field" value={f.audience} onChange={(e) => set("audience", e.target.value)}>{audiences.map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></Field>
          <Field label={tr("يفتح على صفحة", "Opens on")}><select className="field" value={f.subroute} onChange={(e) => set("subroute", e.target.value)}>{targets.map(([k, l]) => (<option key={k} value={k}>{l}</option>))}</select></Field>
        </div>
        <div className="space-y-2">
          <p className="label">{tr("متى يُرسل؟", "When to send")}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={tr("موعد الإرسال", "Send time")}>
            {([["now", tr("الآن", "Now")], ["local", tr("ساعة محددة بتوقيت كل مستخدم", "A set hour in each user's time")], ["at", tr("وقت واحد للجميع", "One time for everyone")]] as const).map(([k, l]) => (<button key={k} className="chip" aria-pressed={when === k} onClick={() => setWhen(k)}>{l}</button>))}
          </div>
          {when === "local" && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className="field !w-auto" dir="ltr" value={localDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setLocalDate(e.target.value)} aria-label={tr("التاريخ", "Date")} />
              <select className="field !w-auto" value={localHour} onChange={(e) => setLocalHour(Number(e.target.value))} aria-label={tr("الساعة", "Hour")}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select>
              <span className="muted">{tr("يصل كل شخص في هذه الساعة بتوقيته (يُنفَّذ كل ساعة).", "Each person gets it at that hour in their own time (runs hourly).")}</span>
            </div>
          )}
          {when === "at" && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="datetime-local" className="field !w-auto" dir="ltr" value={atValue} onChange={(e) => setAtValue(e.target.value)} aria-label={tr("الوقت", "Time")} />
              <span className="muted">{tr("بتوقيت جهازك. التنفيذ خلال ساعة من الموعد.", "In your device's time. Runs within an hour of the chosen time.")}</span>
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={preview} disabled={busy || !hasText || !scheduleOk}>{busy ? <Spinner size={18} /> : <Icon name="bell" />}{tr("راجع وأرسل", "Review and send")}</button>
        {done && <Notice tone="ok">{done}</Notice>}
        <Sheet open={!!prev} onClose={() => !busy && setPrev(null)} title={tr("تأكيد الإرسال", "Confirm sending")}>
          {prev && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-brand-50 p-4 text-sm font-bold">
                <p>{tr("المستلمون:", "Audience:")} {audName(f.audience)}</p>
                <p>{tr(`${prev.people} مستخدم، منهم ${prev.pi} عبر مركز إشعارات Pi و${prev.devices} جهاز متصفح.`, `${prev.people} users: ${prev.pi} via the Pi Notification Center and ${prev.devices} browser devices.`)}</p>
                <p>{when === "now" ? tr("الإرسال: الآن", "Sending: now") : when === "local" ? tr(`الإرسال: ${localDate} الساعة ${String(localHour).padStart(2, "0")}:00 بتوقيت كل مستخدم`, `Sending: ${localDate} at ${String(localHour).padStart(2, "0")}:00 in each user's time`) : tr(`الإرسال: ${new Date(atValue).toLocaleString()}`, `Sending: ${new Date(atValue).toLocaleString()}`)}</p>
                {prev.truncated && <p className="text-rose-600">{tr("وصلنا للحد الأقصى 5000 مستخدم في الإرسال الواحد.", "Reached the 5000-user limit for one send.")}</p>}
              </div>
              <div className="space-y-1 text-sm">
                {f.title_ar && f.body_ar && <p dir="rtl"><span className="font-extrabold">{f.title_ar}</span> - {f.body_ar}</p>}
                {f.title_en && f.body_en && <p dir="ltr"><span className="font-extrabold">{f.title_en}</span> - {f.body_en}</p>}
              </div>
              <p className="muted">{tr("بعد الإرسال لا يمكن التراجع. المجدول يمكن إلغاؤه قبل موعده. Pi يسلّم فقط لمن فعّل الإشعارات، وبحد أقصى 48 إشعارًا للمستخدم يوميًا.", "Once sent it cannot be undone; a scheduled one can be cancelled before its time. Pi delivers only to people who allow notifications, with a maximum of 48 per user per day.")}</p>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" disabled={busy} onClick={() => setPrev(null)}>{tr("إلغاء", "Cancel")}</button>
                <button className="btn-primary flex-1" disabled={busy || prev.people === 0} onClick={send}>{busy ? <Spinner size={18} /> : null}{when === "now" ? tr("أرسل الآن", "Send now") : tr("جدولة", "Schedule")}</button>
              </div>
            </div>
          )}
        </Sheet>
        <div>
          <h3 className="mb-2 font-extrabold">{tr("آخر الإرسالات", "Recent sends")}</h3>
          {ov === null ? <Spinner size={18} /> : ov.broadcasts.length === 0 ? <p className="muted">{tr("لا إرسالات بعد.", "Nothing sent yet.")}</p> : (
            <ul className="divide-y divide-line text-sm">
              {ov.broadcasts.map((h) => (
                <li key={h.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-x-3"><span className="font-extrabold">{h.title_ar || h.title_en}</span><span className="muted">{audName(h.audience)}</span><span className={`text-xs font-bold ${h.status === "done" ? "text-brand-700" : h.status === "failed" ? "text-rose-600" : "text-ink-soft"}`}>{statusLabel(h)}</span><span className="ms-auto text-xs text-ink-soft" dir="ltr">{new Date(h.created_at).toLocaleString()}</span></div>
                  <p className="muted tabular-nums">{tr(`${h.recipients} مستلم · Pi ${h.pi_delivered}/${h.pi_requested} · متصفح ${h.push_sent}/${h.push_devices} · فتحوا التطبيق ${h.opened} (${pct(h.opened, h.recipients)})`, `${h.recipients} recipients · Pi ${h.pi_delivered}/${h.pi_requested} · browser ${h.push_sent}/${h.push_devices} · opened ${h.opened} (${pct(h.opened, h.recipients)})`)}</p>
                  {h.status === "scheduled" && <button className="btn-ghost btn-sm mt-1" onClick={() => cancel(h.id)}>{tr("إلغاء الجدولة", "Cancel schedule")}</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/** Test panel: sends a notification to the admin's own account and shows what each channel did. */
function NotifyAdmin() {
  const { tr, toast, errMsg } = useApp();
  const [title, setTitle] = useState("Healthy test");
  const [body, setBody] = useState("If you can read this, notifications work.");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<NotifyResult | null>(null);
  const send = async (delaySec = 0) => {
    setBusy(true);
    if (delaySec) toast(tr(`سيصل الإشعار بعد ${delaySec} ثانية. أغلق التطبيق الآن.`, `It will arrive in ${delaySec} seconds. Close the app now.`), "ok");
    try { setRes(await api<NotifyResult>("/admin/notify", { body: { title, body, delaySec } })); } catch (e) { if (!delaySec) toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  const piLine = !res ? "" : res.pi.error ? tr(`فشل الإرسال (${res.pi.error}).`, `Send failed (${res.pi.error}).`) : res.pi.delivered > 0 ? tr("تم التسليم لمركز إشعارات Pi. افتح الإشعارات في تطبيق Pi.", "Delivered to the Pi Notification Center. Open Notifications in the Pi app.") : tr("Pi لم تسلّم الإشعار: غالبًا لم تمنح صلاحية الإشعارات بعد. سجّل خروجًا ثم دخولًا من Pi Browser ووافق عليها، أو الإشعارات مقفولة في تطبيق Pi.", "Pi did not deliver it: most likely the notifications permission has not been granted yet. Sign out and in again from Pi Browser and accept it, or notifications are off in the Pi app.");
  return (
    <section className="card space-y-4">
      <h2 className="h2">{tr("اختبار الإشعارات", "Test notifications")}</h2>
      <p className="muted">{tr("يُرسل إلى حسابك أنت فقط (مركز إشعارات Pi وأجهزتك المفعّلة للتذكير).", "Sent to your own account only (the Pi Notification Center and your devices that enabled reminders).")}</p>
      <Field label={tr("العنوان", "Title")}><input className="field" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label={tr("الرسالة", "Message")}><textarea className="field" rows={2} maxLength={160} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => send(0)} disabled={busy || !title.trim() || !body.trim()}>{busy ? <Spinner size={18} /> : <Icon name="bell" />}{tr("أرسل إشعارًا تجريبيًا لي", "Send me a test notification")}</button>
        <button className="btn-ghost" onClick={() => send(30)} disabled={busy || !title.trim() || !body.trim()}>{tr("أرسل بعد 30 ثانية (أغلق التطبيق أولًا)", "Send in 30 s (close the app first)")}</button>
      </div>
      {res && (
        <div className="space-y-2 text-sm font-bold" role="status">
          <p><span className="text-ink-soft">Pi: </span>{piLine}</p>
          <p><span className="text-ink-soft">Web Push: </span>{!res.push.configured ? tr("غير مفعّل على الخادم.", "Not configured on the server.") : res.push.devices === 0 ? tr("لا توجد أجهزة مفعّلة. فعّل «التذكير اليومي» من ملفك الشخصي في متصفح عادي.", "No devices subscribed. Turn on Daily reminder in your profile from a regular browser.") : tr(`أُرسل لـ ${res.push.sent} من ${res.push.devices} جهاز.`, `Sent to ${res.push.sent} of ${res.push.devices} device(s).`)}{res.push.statuses?.length ? ` (push service: ${res.push.statuses.join(", ")})` : ""}</p>
        </div>
      )}
    </section>
  );
}


type UserRow = { username: string; created_at: string; last_login_at: string | null; login_count: number; kyc_verified: boolean; language: string; deleted: boolean; active_days: number; first_day: string | null; last_day: string | null; ai_requests: number; food_entries: number; challenges_done: number; plan_active: boolean; pi_paid: number; purchases: number; last_purchase: string | null; credits_left: number; country: string | null };
type CountryRow = { code: string; users: number; active30: number; paying: number; pi: number | string; ai: number };
type Report = {
  users: UserRow[];
  daily: { day: string; active: number; new: number }[];
  countries: CountryRow[];
  summary: { total: number; dau: number; wau: number; mau: number; returned: number; never_returned: number; avg_active_days: number; avg_logins: number; d1_eligible: number; d1_returned: number; d7_eligible: number; d7_returned: number; paying_users: number; pi_total: number; purchases_total: number; credits_outstanding: number; ai_total: number };
};
const fmtPi = (n: number | string) => { const v = Number(n); return Number.isInteger(v) ? String(v) : v.toFixed(2); };
/** Country name in the viewer's language from a two-letter code ("??" = not known yet). */
const countryName = (code: string | null, lang: string) => {
  if (!code || code === "??") return lang === "ar" ? "غير معروف" : "Unknown";
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code; } catch { return code; }
};
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "-");
const ago = (iso: string | null, tr: (a: string, e: string) => string) => {
  if (!iso) return "-";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return tr(`منذ ${m} د`, `${m} min ago`);
  const h = Math.round(m / 60);
  if (h < 48) return tr(`منذ ${h} ساعة`, `${h} h ago`);
  const d = Math.round(h / 24);
  return tr(`منذ ${d} يوم`, `${d} d ago`);
};

/** Owner-only: every Pioneer who signed in (Pi username, dates and counters only) with daily activity and return rates. */
function UsersAdmin() {
  const { tr, toast, errMsg, lang } = useApp();
  const [r, setR] = useState<Report | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"login" | "created" | "days" | "ai" | "pi">("login");
  const [page, setPage] = useState(0);
  const load = useCallback((fresh = false) => { api<Report>(`/admin/users${fresh ? "?fresh=1" : ""}`).then(setR).catch((e) => toast(errMsg(e), "err")); }, [toast, errMsg]);
  useEffect(() => { load(); }, [load]);
  if (!r) return <div className="card flex items-center gap-2 py-6"><Spinner /><span className="muted">{tr("جارٍ التحميل...", "Loading...")}</span></div>;
  const s = r.summary;
  const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-");
  const rows = r.users
    .filter((u) => !q.trim() || u.username.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => sort === "created" ? +new Date(b.created_at) - +new Date(a.created_at) : sort === "days" ? b.active_days - a.active_days : sort === "ai" ? b.ai_requests - a.ai_requests : sort === "pi" ? Number(b.pi_paid) - Number(a.pi_paid) : +new Date(b.last_login_at ?? b.created_at) - +new Date(a.last_login_at ?? a.created_at));
  const PAGE = 50;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const maxActive = Math.max(1, ...r.daily.map((d) => d.active));
  const kpis: [string, string][] = [
    [tr("نشطون اليوم", "Active today"), String(s.dau)],
    [tr("نشطون آخر 7 أيام", "Active, last 7 days"), String(s.wau)],
    [tr("نشطون آخر 30 يومًا", "Active, last 30 days"), String(s.mau)],
    [tr("عادوا مرة أخرى", "Came back at least once"), `${s.returned} (${pct(s.returned, s.total)})`],
    [tr("لم يعودوا", "Never came back"), `${s.never_returned} (${pct(s.never_returned, s.total)})`],
    [tr("متوسط أيام الاستخدام", "Avg days of use per user"), String(s.avg_active_days)],
    [tr("متوسط مرات الدخول", "Avg sign-ins per user"), String(s.avg_logins)],
    [tr("عودة في اليوم التالي", "Back the next day"), `${pct(s.d1_returned, s.d1_eligible)} (${s.d1_returned}/${s.d1_eligible})`],
    [tr("عودة خلال 7 أيام", "Back within 7 days"), `${pct(s.d7_returned, s.d7_eligible)} (${s.d7_returned}/${s.d7_eligible})`],
    [tr("إجمالي Pi المدفوعة", "Total Pi paid"), `${fmtPi(s.pi_total)} Pi`],
    [tr("مستخدمون دفعوا", "Paying users"), `${s.paying_users} (${pct(s.paying_users, s.total)})`],
    [tr("متوسط الدفع لكل دافع", "Avg Pi per payer"), s.paying_users ? `${fmtPi(s.pi_total / s.paying_users)} Pi` : "-"],
    [tr("كريدت غير مستهلك", "Credits not yet used"), String(s.credits_outstanding)],
    [tr("طلبات AI منجزة", "AI requests completed"), String(s.ai_total)],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {kpis.map(([l, v]) => (<div key={l} className="card"><p className="text-2xl font-extrabold tabular-nums">{v}</p><p className="muted">{l}</p></div>))}
      </div>
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="h2">{tr("النشاط اليومي (آخر 30 يومًا)", "Daily activity (last 30 days)")}</h2><button className="chip" onClick={() => load(true)}>{tr("تحديث", "Refresh")}</button></div>
        <div className="flex h-32 items-end gap-[3px]" dir="ltr" role="img" aria-label={tr("رسم النشاط اليومي", "Daily activity chart")}>
          {r.daily.map((d) => (
            <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.day}: ${d.active} ${tr("نشط", "active")}, ${d.new} ${tr("جديد", "new")}`}>
              <div className="w-full rounded-t bg-brand-500" style={{ height: `${(d.active / maxActive) * 100}%`, minHeight: d.active ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-ink-soft tabular-nums" dir="ltr"><span>{r.daily[0]?.day.slice(5)}</span><span>{r.daily[r.daily.length - 1]?.day.slice(5)}</span></div>
        <p className="muted">{tr("يُحسب اليوم بتوقيت كل مستخدم. اليوم يُسجَّل عند فتح التطبيق أو الدخول بـ Pi. البيانات قبل هذه الميزة مأخوذة من نشاط المستخدمين المحفوظ (تحديات وأكل وعادات)، وآخر دخول لها تقريبي.", "A day is counted in each user's own time zone and is recorded when the app is opened or a user signs in with Pi. Older data comes from stored activity (challenges, food, habits), so their last sign-in is approximate.")}</p>
      </section>
      <section className="card space-y-3">
        <h2 className="h2">{tr("المستخدمون حسب الدولة", "Users by country")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-xs font-extrabold text-ink-soft"><th className="py-2 text-start">#</th><th className="text-start">{tr("الدولة", "Country")}</th><th>{tr("مستخدمون", "Users")}</th><th>{tr("النسبة", "Share")}</th><th>{tr("نشطون 30 يومًا", "Active 30 d")}</th><th>{tr("دافعون", "Paying")}</th><th>{tr("AI", "AI")}</th></tr></thead>
            <tbody>
              {r.countries.map((c, i) => (
                <tr key={c.code} className="border-t border-line text-center">
                  <td className="py-2 text-start tabular-nums text-ink-soft">{i + 1}</td>
                  <td className="text-start font-extrabold">{countryName(c.code, lang)}{c.code !== "??" ? <span className="ms-1 text-xs font-normal text-ink-soft" dir="ltr">{c.code}</span> : null}</td>
                  <td className="tabular-nums font-extrabold">{c.users}</td>
                  <td className="tabular-nums">{pct(c.users, s.total)}</td>
                  <td className="tabular-nums">{c.active30}</td>
                  <td className="tabular-nums">{c.paying}</td>
                  <td className="tabular-nums">{c.ai}</td>
                </tr>
              ))}
              {r.countries.length === 0 && <tr><td colSpan={7} className="py-6 text-center muted">{tr("لا بيانات بعد.", "No data yet.")}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted">{tr("الدولة تُستنتج من عنوان الاتصال وقت الدخول، ولا يُحفظ عنوان IP نفسه. المستخدمون القدامى يظهرون \"غير معروف\" إلى أن يفتحوا التطبيق مرة أخرى.", "The country is derived from the connection at sign-in; the IP address itself is never stored. Existing users show as Unknown until they next open the app.")}</p>
      </section>
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="h2 me-auto">{tr("المستخدمون", "Users")} ({rows.length})</h2>
          <input className="field max-w-[180px]" dir="ltr" placeholder={tr("بحث باسم المستخدم", "Search username")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label={tr("بحث", "Search")} />
          <select className="field max-w-[190px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={tr("ترتيب", "Sort")}>
            <option value="login">{tr("آخر دخول", "Last sign-in")}</option>
            <option value="created">{tr("تاريخ التسجيل", "Registered")}</option>
            <option value="days">{tr("أيام الاستخدام", "Days of use")}</option>
            <option value="ai">{tr("طلبات AI", "AI requests")}</option>
            <option value="pi">{tr("Pi المدفوعة", "Pi paid")}</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead><tr className="text-xs font-extrabold text-ink-soft"><th className="py-2 text-start">Pi username</th><th className="text-start">{tr("سجّل في", "Registered")}</th><th className="text-start">{tr("آخر دخول", "Last sign-in")}</th><th>{tr("الدولة", "Country")}</th><th>{tr("مرات الدخول", "Sign-ins")}</th><th>{tr("أيام الاستخدام", "Days used")}</th><th>{tr("Pi مدفوعة", "Pi paid")}</th><th>{tr("كريدت متبقٍّ", "Credits left")}</th><th>{tr("AI", "AI")}</th><th>{tr("أكل", "Food")}</th><th>{tr("تحديات", "Challenges")}</th><th>{tr("خطة", "Plan")}</th></tr></thead>
            <tbody>
              {view.map((u) => (
                <tr key={u.username} className="border-t border-line text-center align-top">
                  <td className="py-2 text-start font-extrabold" dir="ltr">{u.username}{u.deleted ? <span className="ms-1 text-xs font-normal text-rose-600">({tr("محذوف", "deleted")})</span> : null}{!u.kyc_verified ? <span className="ms-1 text-xs font-normal text-ink-soft">(no KYC)</span> : null}</td>
                  <td className="text-start text-ink-soft"><span className="block">{dt(u.created_at)}</span></td>
                  <td className="text-start"><span className="block">{dt(u.last_login_at)}</span><span className="text-xs text-ink-soft">{ago(u.last_login_at, tr)}</span></td>
                  <td className="text-ink-soft">{u.country ? countryName(u.country, lang) : "-"}</td>
                  <td className="tabular-nums">{u.login_count}</td>
                  <td className="tabular-nums">{u.active_days}</td>
                  <td className="tabular-nums">{Number(u.pi_paid) > 0 ? <span className="font-extrabold text-brand-700">{fmtPi(u.pi_paid)}<span className="block text-[11px] font-normal text-ink-soft">{u.purchases} {tr("عملية", "orders")}</span></span> : "-"}</td>
                  <td className="tabular-nums">{u.credits_left}</td>
                  <td className="tabular-nums">{u.ai_requests}</td>
                  <td className="tabular-nums">{u.food_entries}</td>
                  <td className="tabular-nums">{u.challenges_done}</td>
                  <td>{u.plan_active ? tr("نعم", "Yes") : "-"}</td>
                </tr>
              ))}
              {view.length === 0 && <tr><td colSpan={12} className="py-6 text-center muted">{tr("لا يوجد مستخدمون مطابقون.", "No matching users.")}</td></tr>}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <button className="chip" disabled={page === 0} onClick={() => setPage(page - 1)}>{tr("السابق", "Previous")}</button>
            <span className="muted tabular-nums">{page + 1} / {pages}</span>
            <button className="chip" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{tr("التالي", "Next")}</button>
          </div>
        )}
        <p className="muted">{tr("أسماء Pi وتواريخ وعدّادات فقط. لا تُعرض بيانات صحية.", "Pi usernames, dates and counters only. No health data is shown.")}</p>
      </section>
    </div>
  );
}


type Monitor = {
  routes: { route: string; n: number; avg_ms: number | null; max_ms: number; e5xx: number; e4xx: number; slow: number }[];
  hourly: { hour: string; n: number; e5xx: number; e4xx: number; slow: number; avg_ms: number | null }[];
  errors: { route: string; status: number; message: string; n: number; first_at: string; last_at: string }[];
  ai24: { completed: number; refunded: number; failed: number; pending_stuck: number; reasons: { error: string; n: number }[] };
  ai_daily: { day: string; completed: number; refunded: number; failed: number }[];
  money_daily: { day: string; purchases: number; pi: number | string }[];
  purchases_open: number;
  db: { total_bytes: number; healthy_bytes: number; connections: number; active_connections: number; top_tables: { name: string; bytes: number; rows: number }[] };
};
const mb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const DB_LIMIT = 500 * 1048576; // Supabase free plan

/** Owner-only: errors, slow routes, AI outcomes, revenue and database health, read from small pre-aggregated tables. */
function MonitorAdmin() {
  const { tr, toast, errMsg } = useApp();
  const [m, setM] = useState<Monitor | null>(null);
  const load = useCallback((fresh = false) => { api<Monitor>(`/admin/monitor${fresh ? "?fresh=1" : ""}`).then(setM).catch((e) => toast(errMsg(e), "err")); }, [toast, errMsg]);
  useEffect(() => { load(); }, [load]);
  if (!m) return <div className="card flex items-center gap-2 py-6"><Spinner /><span className="muted">{tr("جارٍ التحميل...", "Loading...")}</span></div>;
  const tot = m.routes.reduce((a, r) => ({ n: a.n + r.n, e5: a.e5 + r.e5xx, e4: a.e4 + r.e4xx, slow: a.slow + r.slow, ms: a.ms + (r.avg_ms ?? 0) * r.n }), { n: 0, e5: 0, e4: 0, slow: 0, ms: 0 });
  const lastHour = m.hourly[m.hourly.length - 1];
  const aiTotal = m.ai24.completed + m.ai24.refunded + m.ai24.failed;
  const aiFailRate = aiTotal ? (m.ai24.refunded + m.ai24.failed) / aiTotal : 0;
  const dbPct = (m.db.total_bytes / DB_LIMIT) * 100;
  const problems: string[] = [];
  if (lastHour && lastHour.e5xx > 0) problems.push(tr(`أخطاء سيرفر (5xx) في آخر ساعة: ${lastHour.e5xx}`, `Server errors (5xx) in the last hour: ${lastHour.e5xx}`));
  if (m.ai24.pending_stuck > 0) problems.push(tr(`طلبات AI عالقة: ${m.ai24.pending_stuck}`, `Stuck AI requests: ${m.ai24.pending_stuck}`));
  if (aiTotal >= 10 && aiFailRate > 0.2) problems.push(tr(`فشل AI مرتفع: ${Math.round(aiFailRate * 100)}%`, `High AI failure rate: ${Math.round(aiFailRate * 100)}%`));
  if (tot.n > 50 && tot.slow / tot.n > 0.05) problems.push(tr("أكثر من 5% من الطلبات بطيئة", "More than 5% of requests are slow"));
  if (dbPct > 70) problems.push(tr(`قاعدة البيانات ${dbPct.toFixed(0)}% من الحد`, `Database is ${dbPct.toFixed(0)}% of its limit`));
  if (m.db.connections > 40) problems.push(tr(`اتصالات قاعدة البيانات كثيرة: ${m.db.connections}`, `Many database connections: ${m.db.connections}`));
  const maxN = Math.max(1, ...m.hourly.map((h) => h.n));
  const cards: [string, string, boolean?][] = [
    [tr("طلبات (24 س)", "Requests (24 h)"), String(tot.n)],
    [tr("أخطاء سيرفر 5xx", "Server errors 5xx"), String(tot.e5), tot.e5 > 0],
    [tr("أخطاء عميل 4xx", "Client errors 4xx"), String(tot.e4)],
    [tr("طلبات بطيئة", "Slow requests"), String(tot.slow), tot.slow > 0 && tot.n > 0 && tot.slow / tot.n > 0.05],
    [tr("متوسط الاستجابة", "Avg response"), tot.n ? `${Math.round(tot.ms / tot.n)} ms` : "-"],
    [tr("AI منجز / مُسترد / فاشل (24 س)", "AI done / refunded / failed (24 h)"), `${m.ai24.completed} / ${m.ai24.refunded} / ${m.ai24.failed}`, aiTotal >= 10 && aiFailRate > 0.2],
    [tr("طلبات AI عالقة", "Stuck AI requests"), String(m.ai24.pending_stuck), m.ai24.pending_stuck > 0],
    [tr("مشتريات مفتوحة (24 س)", "Open purchases (24 h)"), String(m.purchases_open)],
    [tr("حجم قاعدة البيانات", "Database size"), `${mb(m.db.total_bytes)} (${dbPct.toFixed(1)}%)`, dbPct > 70],
    [tr("منها Healthy", "of which Healthy"), mb(m.db.healthy_bytes)],
    [tr("اتصالات القاعدة (نشطة / كلها)", "DB connections (active / all)"), `${m.db.active_connections} / ${m.db.connections}`, m.db.connections > 40],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Notice tone={problems.length ? "bad" : "ok"}>{problems.length ? problems.join(" · ") : tr("لا توجد مشاكل ظاهرة الآن.", "No visible problems right now.")}</Notice>
        <span className="ms-auto flex items-center gap-2">
          <button className="chip" onClick={() => load(true)}>{tr("تحديث", "Refresh")}</button>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(([l, v, bad]) => (<div key={l} className="card"><p className={`text-2xl font-extrabold tabular-nums ${bad ? "text-rose-600" : ""}`}>{v}</p><p className="muted">{l}</p></div>))}
      </div>
      <section className="card space-y-3">
        <h2 className="h2">{tr("الطلبات في الساعة (آخر 24 ساعة)", "Requests per hour (last 24 h)")}</h2>
        <div className="flex h-28 items-end gap-[3px]" dir="ltr" role="img" aria-label={tr("رسم الطلبات", "Requests chart")}>
          {m.hourly.map((h) => (
            <div key={h.hour} className="flex h-full flex-1 flex-col justify-end" title={`${new Date(h.hour).toLocaleString()}: ${h.n} req, ${h.e5xx} 5xx, ${h.slow} slow, avg ${h.avg_ms ?? 0} ms`}>
              <div className={`w-full rounded-t ${h.e5xx ? "bg-rose-500" : h.slow ? "bg-sun-500" : "bg-brand-500"}`} style={{ height: `${(h.n / maxN) * 100}%`, minHeight: h.n ? 3 : 0 }} />
            </div>
          ))}
        </div>
        <p className="muted">{tr("أخضر: سليم، برتقالي: فيه طلبات بطيئة، أحمر: فيه أخطاء سيرفر. الأرقام من عدّاد داخل التطبيق يُكتب على دفعات (كل 15 ثانية كحد أقصى لكل نسخة)، فهي تقريبية وتُحفظ 14 يومًا.", "Green: healthy, orange: has slow requests, red: has server errors. Numbers come from an in-app counter written in batches (at most every 15 s per server instance), so they are approximate and kept 14 days.")}</p>
      </section>
      <section className="card space-y-3">
        <h2 className="h2">{tr("أحدث الأخطاء", "Recent errors")}</h2>
        {m.errors.length === 0 ? <p className="muted">{tr("لا أخطاء مسجّلة.", "No errors recorded.")}</p> : (
          <ul className="divide-y divide-line text-sm">{m.errors.map((e, i) => (
            <li key={i} className="space-y-0.5 py-2">
              <div className="flex flex-wrap items-center gap-x-3"><span className="font-extrabold text-rose-600">{e.status}</span><span dir="ltr" className="font-bold">{e.route}</span><span className="muted tabular-nums">x{e.n}</span><span className="ms-auto text-xs text-ink-soft" dir="ltr">{ago(e.last_at, tr)}</span></div>
              <p className="break-words text-ink-soft" dir="ltr">{e.message}</p>
            </li>))}
          </ul>
        )}
      </section>
      <section className="card space-y-3">
        <h2 className="h2">{tr("المسارات (آخر 24 ساعة)", "Routes (last 24 h)")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-xs font-extrabold text-ink-soft"><th className="py-2 text-start">{tr("المسار", "Route")}</th><th>{tr("طلبات", "Requests")}</th><th>5xx</th><th>4xx</th><th>{tr("بطيء", "Slow")}</th><th>{tr("متوسط", "Avg")}</th><th>{tr("أقصى", "Max")}</th></tr></thead>
            <tbody>
              {m.routes.map((r) => (
                <tr key={r.route} className="border-t border-line text-center">
                  <td className="py-2 text-start font-bold" dir="ltr">{r.route}</td>
                  <td className="tabular-nums">{r.n}</td>
                  <td className={`tabular-nums ${r.e5xx ? "font-extrabold text-rose-600" : ""}`}>{r.e5xx}</td>
                  <td className="tabular-nums">{r.e4xx}</td>
                  <td className={`tabular-nums ${r.slow ? "font-extrabold text-sun-600" : ""}`}>{r.slow}</td>
                  <td className="tabular-nums">{r.avg_ms ?? "-"} ms</td>
                  <td className="tabular-nums text-ink-soft">{r.max_ms} ms</td>
                </tr>
              ))}
              {m.routes.length === 0 && <tr><td colSpan={7} className="py-6 text-center muted">{tr("لا بيانات بعد: ستظهر بعد أول طلبات.", "No data yet: it appears after the first requests.")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card space-y-3">
        <h2 className="h2">{tr("الذكاء الاصطناعي", "AI")}</h2>
        {m.ai24.reasons.length > 0 && (<div><p className="muted mb-1">{tr("أسباب الفشل / الاسترداد (24 ساعة)", "Failure / refund reasons (24 h)")}</p><div className="flex flex-wrap gap-2">{m.ai24.reasons.map((r) => (<span key={r.error} className="chip" dir="ltr">{r.error} x{r.n}</span>))}</div></div>)}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead><tr className="text-xs font-extrabold text-ink-soft"><th className="py-2 text-start">{tr("اليوم", "Day")}</th><th>{tr("منجز", "Done")}</th><th>{tr("مُسترد", "Refunded")}</th><th>{tr("فاشل", "Failed")}</th></tr></thead>
            <tbody>{m.ai_daily.slice().reverse().map((d) => (<tr key={d.day} className="border-t border-line text-center"><td className="py-2 text-start tabular-nums" dir="ltr">{d.day}</td><td className="tabular-nums">{d.completed}</td><td className="tabular-nums">{d.refunded}</td><td className="tabular-nums">{d.failed}</td></tr>))}</tbody>
          </table>
        </div>
      </section>
      <section className="card space-y-3">
        <h2 className="h2">{tr("Pi المستلمة (آخر 14 يومًا)", "Pi received (last 14 days)")}</h2>
        {m.money_daily.length === 0 ? <p className="muted">{tr("لا مدفوعات في هذه الفترة.", "No payments in this period.")}</p> : (
          <ul className="divide-y divide-line text-sm">{m.money_daily.slice().reverse().map((d) => (<li key={d.day} className="flex items-center gap-3 py-2"><span className="tabular-nums" dir="ltr">{d.day}</span><span className="muted">{d.purchases} {tr("عملية", "orders")}</span><span className="ms-auto font-extrabold tabular-nums">{fmtPi(d.pi)} Pi</span></li>))}</ul>
        )}
      </section>
      <section className="card space-y-3">
        <h2 className="h2">{tr("أكبر الجداول", "Largest tables")}</h2>
        <ul className="divide-y divide-line text-sm">{m.db.top_tables.map((t) => (<li key={t.name} className="flex items-center gap-3 py-2"><span className="font-bold" dir="ltr">{t.name}</span><span className="muted tabular-nums">{t.rows >= 0 ? `${t.rows} ${tr("صف", "rows")}` : ""}</span><span className="ms-auto tabular-nums">{mb(t.bytes)}</span></li>))}</ul>
      </section>
    </div>
  );
}
