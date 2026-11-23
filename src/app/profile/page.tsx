"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearGetCache } from "@/lib/useGet";
import { useApp } from "@/components/AppProvider";
import { Field, Gate, Notice, PageHeader, Spinner, VerifiedBadge } from "@/components/ui";
import { DisclaimerBanner } from "@/components/Domain";
import { Icon } from "@/components/Icon";
import { AppFeatures } from "@/components/AppFeatures";

type F = { age: string; sex: string; weight: string; height: string; goal: string; activity: string; conditions: string[] };

function Choice({ value, options, onChange, label }: { value: string; options: [string, string, string?][]; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, minmax(0,1fr))` }}>
      {options.map(([v, l, ic]) => (
        <button type="button" key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 text-sm font-extrabold transition ${value === v ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white text-ink-soft"}`}>
          {ic && <Icon name={ic} size={20} />}{l}
        </button>
      ))}
    </div>
  );
}

function DataControls({ username, onDeleted }: { username: string; onDeleted: () => void }) {
  const { tr, toast, errMsg } = useApp();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const exportData = async () => {
    try {
      const data = await api("/me/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "healthy-my-data.json"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast(errMsg(e), "err"); }
  };
  const del = async () => {
    setBusy(true);
    try { await api("/me", { method: "DELETE", body: { confirm } }); toast(tr("تم حذف بياناتك", "Your data was deleted"), "ok"); onDeleted(); }
    catch (e) { toast(errMsg(e), "err"); } finally { setBusy(false); }
  };
  return (
    <section className="card space-y-3">
      <h2 className="h2">{tr("بياناتي", "My data")}</h2>
      <p className="muted">{tr("حمّل نسخة من كل بياناتك، أو احذفها. الحذف يمسح ملفك الصحي ووزنك ونظامك ووصفاتك ونشاطك. سجلات الدفع والكريدت تبقى كسجل مالي بدون بيانات شخصية.", "Download a copy of your data, or delete it. Deleting erases your health profile, weight, plans, content and activity. Payment and credit records are kept as a financial record without personal data.")}</p>
      <button className="btn-soft w-full" onClick={exportData}><Icon name="share" size={18} />{tr("تحميل بياناتي (JSON)", "Download my data (JSON)")}</button>
      {!open ? (
        <button className="btn-ghost w-full !text-rose-600" onClick={() => setOpen(true)}><Icon name="trash" size={18} />{tr("حذف حسابي وبياناتي", "Delete my account and data")}</button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50 p-3">
          <p className="text-sm font-bold text-rose-600">{tr("لا يمكن التراجع. اكتب اسم المستخدم للتأكيد:", "This cannot be undone. Type your username to confirm:")} <bdi dir="ltr">{username}</bdi></p>
          <input className="field" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="username" />
          <button className="btn w-full bg-rose-600 text-white" disabled={busy || confirm.toLowerCase() !== username.toLowerCase()} onClick={del}>{busy ? <Spinner size={18} /> : <Icon name="trash" size={18} />}{tr("احذف نهائيًا", "Delete permanently")}</button>
        </div>
      )}
    </section>
  );
}

function Inner() {
  const { me, tr, refresh, toast, errMsg, setLang, lang, signOut } = useApp();
  const router = useRouter();
  const p = me!.profile;
  const wizard = !p.disclaimer_accepted_at;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [accept, setAccept] = useState(false);
  const [leader, setLeader] = useState(p.leaderboard_visible);
  const [f, setF] = useState<F>({ age: "", sex: "", weight: "", height: "", goal: "", activity: "", conditions: [] });
  useEffect(() => {
    setF({ age: p.age?.toString() ?? "", sex: p.sex ?? "", weight: p.weight_kg?.toString() ?? "", height: p.height_cm?.toString() ?? "", goal: p.goal ?? "", activity: p.activity ?? "", conditions: p.conditions });
    setLeader(p.leaderboard_visible);
  }, [p.age, p.sex, p.weight_kg, p.height_cm, p.goal, p.activity, p.conditions, p.leaderboard_visible]);

  const set = (k: keyof F, v: string | string[]) => setF((x) => ({ ...x, [k]: v }));
  const toggleCond = (c: string) => set("conditions", f.conditions.includes(c) ? f.conditions.filter((x) => x !== c) : [...f.conditions, c]);
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const body = () => ({ age: num(f.age), sex: f.sex || null, weight_kg: num(f.weight), height_cm: num(f.height), goal: f.goal || null, activity: f.activity || null, conditions: f.conditions, leaderboard_visible: leader });
  const save = async (acceptNow: boolean) => {
    setSaving(true);
    try {
      await api("/me", { method: "PATCH", body: { ...body(), ...(acceptNow ? { accept_disclaimer: true } : {}) } });
      await refresh();
      toast(tr("تم حفظ ملفك الصحي", "Profile saved"), "ok");
      if (acceptNow) router.push("/today");
    } catch (e) { toast(errMsg(e), "err"); } finally { setSaving(false); }
  };

  const ageOk = Number(f.age) >= 5 && Number(f.age) <= 120;
  const steps = [
    { title: tr("العمر والهدف", "Age and goal"), valid: ageOk && !!f.goal, body: (
      <div className="space-y-5">
        <Field label={tr("العمر (سنة) *", "Age (years) *")}><input className="field" inputMode="numeric" type="number" min={5} max={120} value={f.age} onChange={(e) => set("age", e.target.value)} /></Field>
        <div><span className="label">{tr("هدفك *", "Your goal *")}</span><Choice label={tr("الهدف", "Goal")} value={f.goal} onChange={(v) => set("goal", v)} options={[["lose", tr("تخسيس", "Lose weight"), "scale"], ["gain", tr("بناء عضلات", "Gain muscle"), "bolt"], ["maintain", tr("ثبات الوزن", "Maintain"), "heart"]]} /></div>
      </div>) },
    { title: tr("الجسم", "Body"), valid: true, body: (
      <div className="space-y-5">
        <div><span className="label">{tr("النوع", "Sex")}</span><Choice label={tr("النوع", "Sex")} value={f.sex} onChange={(v) => set("sex", v)} options={[["male", tr("ذكر", "Male")], ["female", tr("أنثى", "Female")]]} /></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("الوزن (كجم)", "Weight (kg)")}><input className="field" inputMode="decimal" type="number" min={20} max={400} step="0.1" value={f.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
          <Field label={tr("الطول (سم)", "Height (cm)")}><input className="field" inputMode="decimal" type="number" min={80} max={250} value={f.height} onChange={(e) => set("height", e.target.value)} /></Field>
        </div>
        <p className="muted">{tr("يمكنك تخطي هذه الخطوة وإكمالها لاحقًا، لكن النظام الغذائي يحتاجها.", "You can skip this and complete it later, but the diet plan needs it.")}</p>
      </div>) },
    { title: tr("النشاط والحالة الصحية", "Activity and health"), valid: true, body: (
      <div className="space-y-5">
        <div><span className="label">{tr("مستوى النشاط", "Activity level")}</span><Choice label={tr("النشاط", "Activity")} value={f.activity} onChange={(v) => set("activity", v)} options={[["low", tr("قليل", "Low")], ["medium", tr("متوسط", "Medium")], ["high", tr("عالي", "High")]]} /></div>
        <div><span className="label">{tr("حالات تحب تعلنها (اختياري)", "Conditions you choose to declare (optional)")}</span>
          <div className="flex flex-wrap gap-2">{[["diabetes", tr("سكري", "Diabetes")], ["hypertension", tr("ضغط", "Hypertension")], ["pregnancy", tr("حمل", "Pregnancy")]].map(([k, l]) => (<button type="button" key={k} className="chip" aria-pressed={f.conditions.includes(k)} onClick={() => toggleCond(k)}>{l}</button>))}<button type="button" className="chip" aria-pressed={f.conditions.length === 0} onClick={() => set("conditions", [])}>{tr("لا شيء", "None")}</button></div>
          <p className="muted mt-2">{tr("بياناتك الصحية خاصة بك فقط ولا تظهر لأي مستخدم أو في لوحة الإدارة.", "Your health data is private to you. It never appears to other users or in admin.")}</p>
        </div>
      </div>) },
    { title: tr("التنبيه الصحي", "Health disclaimer"), valid: accept, body: (
      <div className="space-y-4">
        <DisclaimerBanner conditions={f.conditions} />
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4">
          <input type="checkbox" className="mt-1 h-6 w-6 accent-brand-600" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span className="font-bold">{tr("قرأت التنبيه الصحي وأوافق عليه. أفهم أن المحتوى إرشاد عام وليس تشخيصًا أو علاجًا.", "I have read the health disclaimer and agree. I understand this is general guidance, not diagnosis or treatment.")}</span>
        </label>
      </div>) },
  ];

  if (wizard) {
    const s = steps[step];
    const last = step === steps.length - 1;
    return (
      <div className="mx-auto max-w-lg py-5">
        <PageHeader title={tr("ملفك الصحي", "Your health profile")} sub={tr("خطوات قصيرة مرة واحدة فقط", "A few short steps, once")} />
        <div className="mb-5 flex gap-1.5" aria-label={tr(`الخطوة ${step + 1} من ${steps.length}`, `Step ${step + 1} of ${steps.length}`)}>{steps.map((_, i) => (<span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-brand-600" : "bg-brand-100"}`} />))}</div>
        <div className="card space-y-4">
          <h2 className="h2">{s.title}</h2>
          {s.body}
          <div className="flex gap-3 pt-2">
            {step > 0 && <button className="btn-soft flex-1" onClick={() => setStep(step - 1)}>{tr("السابق", "Back")}</button>}
            {!last ? (
              <>
                {step > 0 && <button className="btn-ghost" onClick={() => setStep(step + 1)}>{tr("تخطي", "Skip")}</button>}
                <button className="btn-primary flex-[2]" disabled={!s.valid} onClick={() => setStep(step + 1)}>{tr("التالي", "Next")}</button>
              </>
            ) : (
              <button className="btn-primary flex-[2]" disabled={!s.valid || saving} onClick={() => save(true)}>{saving ? <Spinner /> : <Icon name="check" />}{tr("حفظ وابدأ", "Save and start")}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-5">
      <PageHeader title={tr("ملفي الصحي", "My health profile")} sub={`@${p.username}`} action={p.kyc_verified ? <VerifiedBadge /> : undefined} />
      {!p.kyc_verified && <Notice tone="warn" icon="shieldCheck">{tr("حسابك غير موثّق (KYC). الشراء وAI والمجتمع تحتاج حساب Pi موثّق.", "Your account is not KYC-verified. Purchases, Healthy AI and community need a verified Pi account.")}</Notice>}
      <section className="card space-y-5">
        <h2 className="h2">{steps[0].title}</h2>{steps[0].body}
      </section>
      <section className="card space-y-5"><h2 className="h2">{steps[1].title}</h2>{steps[1].body}</section>
      <section className="card space-y-5"><h2 className="h2">{steps[2].title}</h2>{steps[2].body}</section>
      <section className="card space-y-4">
        <h2 className="h2">{tr("اللغة والخصوصية", "Language and privacy")}</h2>
        <div><span className="label">{tr("اللغة", "Language")}</span><Choice label={tr("اللغة", "Language")} value={lang} onChange={(v) => setLang(v as "ar" | "en")} options={[["ar", "العربية"], ["en", "English"]]} /></div>
        <label className="flex cursor-pointer items-center gap-3"><input type="checkbox" className="h-6 w-6 accent-brand-600" checked={leader} onChange={(e) => setLeader(e.target.checked)} /><span className="font-bold">{tr("أظهر اسمي في لوحة المتصدرين", "Show me on the leaderboard")}</span></label>
        <p className="muted">{tr("لن يظهر وزنك أو حالتك الصحية أو نظامك الغذائي في أي مكان عام.", "Your weight, conditions and diet plan are never shown anywhere public.")}</p>
      </section>
      <AppFeatures />
      <DisclaimerBanner conditions={f.conditions} />
      <DataControls username={p.username} onDeleted={() => { clearGetCache(); signOut(); }} />
      <button className="btn-primary w-full" disabled={saving || !ageOk || !f.goal} onClick={() => save(false)}>{saving ? <Spinner /> : <Icon name="check" />}{tr("حفظ التغييرات", "Save changes")}</button>
    </div>
  );
}
export default function ProfilePage() { return <Gate><Inner /></Gate>; }
