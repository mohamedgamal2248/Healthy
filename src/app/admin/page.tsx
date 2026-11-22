"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import { Field, Gate, Notice, PageHeader, PageSkeleton, Spinner } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { INGREDIENTS, MEAL_TAGS } from "@/data/ingredients";

type Ch = { id: string; type: string; title_ar: string; title_en: string; target_value: number | null; unit: string | null; active: boolean };
type Meal = { id: string; meal_type: "breakfast" | "lunch" | "dinner"; name_ar: string; name_en: string; photo_url: string | null; time_min: number; calories: number; protein_g: number; cost_egp: number; why_ar: string; why_en: string; tags: string[]; ingredients: { item: string; qty: string; key?: string }[]; steps: string[]; active: boolean };
type Stats = { users: number; challengesCompleted: number; recipesGenerated: number; plansActive: number; piReceived: number };

function Inner() {
  const { me, tr, toast, errMsg } = useApp();
  const [tab, setTab] = useState<"stats" | "challenges" | "meals" | "rotation" | "group">("stats");
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
      <PageHeader title={tr("لوحة الإدارة", "Admin")} sub={tr("أدوات المحتوى والإجماليات فقط. لا تُعرض ملفات صحية فردية.", "Content tools and totals only. No individual health profiles are shown.")} />
      <div className="flex flex-wrap gap-2">{([["stats", tr("الإجماليات", "Totals")], ["challenges", tr("التحديات", "Challenges")], ["meals", tr("الوجبات", "Meals")], ["rotation", tr("وجبات اليوم", "Daily rotation")], ["group", tr("تحدي الأسبوع", "Weekly challenge")]] as const).map(([k, l]) => (<button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>))}</div>

      {tab === "stats" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[["users", tr("المستخدمون", "Users"), stats.users], ["check", tr("تحديات منجزة", "Challenges completed"), stats.challengesCompleted], ["chef", tr("وصفات AI", "Recipes generated"), stats.recipesGenerated], ["sparkles", tr("خطط فعّالة", "Plans active"), stats.plansActive], ["pi", tr("Pi المستلمة", "Pi received"), stats.piReceived]].map(([ic, l, v]) => (
            <div key={l as string} className="card"><Icon name={ic as string} size={22} className="text-brand-600" /><p className="mt-2 text-3xl font-extrabold tabular-nums">{v as number}</p><p className="muted">{l as string}</p></div>
          ))}
        </div>
      )}
      {tab === "challenges" && <ChallengeAdmin items={chs} onSave={(c) => post("/admin/challenges", c)} busy={busy} />}
      {tab === "meals" && <MealAdmin items={meals} onSave={(m) => post("/admin/meals", m)} busy={busy} />}
      {tab === "rotation" && <Rotation meals={meals} onSave={(b) => post("/admin/rotation", b)} busy={busy} />}
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
          <Field label={tr("رابط الصورة (اختياري)", "Photo URL (optional)")}><input className="field" dir="ltr" value={f.photo_url ?? ""} onChange={(e) => setF({ ...f, photo_url: e.target.value || null })} /></Field>
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
