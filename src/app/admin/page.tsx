"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import { Field, Gate, Notice, PageHeader, PageSkeleton, Spinner } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { INGREDIENTS, MEAL_TAGS } from "@/data/ingredients";

type Ch = { id: string; type: string; title_ar: string; title_en: string; target_value: number | null; unit: string | null; active: boolean };
type Meal = { id: string; meal_type: "breakfast" | "lunch" | "dinner"; name_ar: string; name_en: string; photo_url: string | null; time_min: number; calories: number; protein_g: number; cost_egp: number; why_ar: string; why_en: string; tags: string[]; ingredients: { item: string; qty: string; key?: string }[]; steps: string[]; active: boolean };
type KindCost = { kind: string; n: number; refunded: number; avgCost: number; totalCost: number; avgIn: number; avgOut: number; avgSearches: number };
type Stats = { aiByKind: KindCost[]; aiCostUsd: number; avgCostUsd: number; aiCalls: number; aiRefunded: number; audit: { admin: string; action: string; target: string | null; created_at: string }[]; users: number; challengesCompleted: number; recipesGenerated: number; plansActive: number; piReceived: number };

function Inner() {
  const { me, tr, toast, errMsg } = useApp();
  const [tab, setTab] = useState<"stats" | "users" | "challenges" | "meals" | "rotation" | "group" | "notify">("stats");
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
      <div className="flex flex-wrap gap-2">{([["stats", tr("الإجماليات", "Totals")], ["users", tr("المستخدمون", "Users")], ["challenges", tr("التحديات", "Challenges")], ["meals", tr("الوجبات", "Meals")], ["rotation", tr("وجبات اليوم", "Daily rotation")], ["group", tr("تحدي الأسبوع", "Weekly challenge")], ["notify", tr("الإشعارات", "Notifications")]] as const).map(([k, l]) => (<button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>))}</div>

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
                          <td className="py-2.5 text-start font-extrabold">{({ recipe: tr("وجبة", "Meal"), workout: tr("تمرين", "Workout"), challenge: tr("تحدٍّ", "Challenge"), scan: tr("تحليل صورة", "Photo scan"), plan: tr("خطة", "Plan") } as Record<string, string>)[k.kind] ?? k.kind}</td>
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
      {tab === "challenges" && <ChallengeAdmin items={chs} onSave={(c) => post("/admin/challenges", c)} busy={busy} />}
      {tab === "meals" && <MealAdmin items={meals} onSave={(m) => post("/admin/meals", m)} busy={busy} />}
      {tab === "rotation" && <Rotation meals={meals} onSave={(b) => post("/admin/rotation", b)} busy={busy} />}
      {tab === "notify" && <NotifyAdmin />}
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


type UserRow = { username: string; created_at: string; last_login_at: string | null; login_count: number; kyc_verified: boolean; language: string; deleted: boolean; active_days: number; first_day: string | null; last_day: string | null; ai_requests: number; food_entries: number; challenges_done: number; plan_active: boolean };
type Report = {
  users: UserRow[];
  daily: { day: string; active: number; new: number }[];
  summary: { total: number; dau: number; wau: number; mau: number; returned: number; never_returned: number; avg_active_days: number; avg_logins: number; d1_eligible: number; d1_returned: number; d7_eligible: number; d7_returned: number };
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
  const { tr, toast, errMsg } = useApp();
  const [r, setR] = useState<Report | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"login" | "created" | "days" | "ai">("login");
  const [page, setPage] = useState(0);
  useEffect(() => { api<Report>("/admin/users").then(setR).catch((e) => toast(errMsg(e), "err")); }, [toast, errMsg]);
  if (!r) return <div className="card flex items-center gap-2 py-6"><Spinner /><span className="muted">{tr("جارٍ التحميل...", "Loading...")}</span></div>;
  const s = r.summary;
  const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-");
  const rows = r.users
    .filter((u) => !q.trim() || u.username.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => sort === "created" ? +new Date(b.created_at) - +new Date(a.created_at) : sort === "days" ? b.active_days - a.active_days : sort === "ai" ? b.ai_requests - a.ai_requests : +new Date(b.last_login_at ?? b.created_at) - +new Date(a.last_login_at ?? a.created_at));
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
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {kpis.map(([l, v]) => (<div key={l} className="card"><p className="text-2xl font-extrabold tabular-nums">{v}</p><p className="muted">{l}</p></div>))}
      </div>
      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="h2">{tr("النشاط اليومي (آخر 30 يومًا)", "Daily activity (last 30 days)")}</h2><span className="muted">{tr("نشطون / جدد", "active / new")}</span></div>
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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="h2 me-auto">{tr("المستخدمون", "Users")} ({rows.length})</h2>
          <input className="field max-w-[180px]" dir="ltr" placeholder={tr("بحث باسم المستخدم", "Search username")} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label={tr("بحث", "Search")} />
          <select className="field max-w-[190px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={tr("ترتيب", "Sort")}>
            <option value="login">{tr("آخر دخول", "Last sign-in")}</option>
            <option value="created">{tr("تاريخ التسجيل", "Registered")}</option>
            <option value="days">{tr("أيام الاستخدام", "Days of use")}</option>
            <option value="ai">{tr("طلبات AI", "AI requests")}</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="text-xs font-extrabold text-ink-soft"><th className="py-2 text-start">Pi username</th><th className="text-start">{tr("سجّل في", "Registered")}</th><th className="text-start">{tr("آخر دخول", "Last sign-in")}</th><th>{tr("مرات الدخول", "Sign-ins")}</th><th>{tr("أيام الاستخدام", "Days used")}</th><th>{tr("AI", "AI")}</th><th>{tr("أكل", "Food")}</th><th>{tr("تحديات", "Challenges")}</th><th>{tr("خطة", "Plan")}</th></tr></thead>
            <tbody>
              {view.map((u) => (
                <tr key={u.username} className="border-t border-line text-center align-top">
                  <td className="py-2 text-start font-extrabold" dir="ltr">{u.username}{u.deleted ? <span className="ms-1 text-xs font-normal text-rose-600">({tr("محذوف", "deleted")})</span> : null}{!u.kyc_verified ? <span className="ms-1 text-xs font-normal text-ink-soft">(no KYC)</span> : null}</td>
                  <td className="text-start text-ink-soft"><span className="block">{dt(u.created_at)}</span></td>
                  <td className="text-start"><span className="block">{dt(u.last_login_at)}</span><span className="text-xs text-ink-soft">{ago(u.last_login_at, tr)}</span></td>
                  <td className="tabular-nums">{u.login_count}</td>
                  <td className="tabular-nums">{u.active_days}</td>
                  <td className="tabular-nums">{u.ai_requests}</td>
                  <td className="tabular-nums">{u.food_entries}</td>
                  <td className="tabular-nums">{u.challenges_done}</td>
                  <td>{u.plan_active ? tr("نعم", "Yes") : "-"}</td>
                </tr>
              ))}
              {view.length === 0 && <tr><td colSpan={9} className="py-6 text-center muted">{tr("لا يوجد مستخدمون مطابقون.", "No matching users.")}</td></tr>}
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
