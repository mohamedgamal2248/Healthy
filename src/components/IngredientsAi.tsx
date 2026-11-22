"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { CoachThinking } from "./CoachThinking";
import { Notice, Sheet, Spinner } from "./ui";
import { INGREDIENT_MAP } from "@/data/ingredients";

/** "Create a meal from my ingredients with AI": explicit cost warning, then 1 request is spent. */
export function IngredientsAiSheet({ open, onClose, keys }: { open: boolean; onClose: () => void; keys: string[] }) {
  const { tr, lang, me, refresh, errMsg, toast } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const names = keys.map((k) => (lang === "ar" ? INGREDIENT_MAP[k]?.ar : INGREDIENT_MAP[k]?.en) ?? k);
  const total = me?.balances?.total ?? 0;
  const accepted = !!me?.profile.disclaimer_accepted_at;
  const verified = !!me?.profile.kyc_verified;

  const go = async () => {
    setBusy(true);
    setErr(null);
    const prompt = lang === "ar" ? `عندي المكونات دي: ${names.join("، ")}. اعمل لي وجبة صحية منها بشكل أساسي.` : `I have these ingredients: ${names.join(", ")}. Create a healthy meal using mainly these.`;
    try {
      const r = await api<{ recipe: { id: string } }>("/chef", { body: { prompt: prompt.slice(0, 390), kind: "recipe", lang } });
      await refresh();
      toast(tr("تم حفظ الوجبة في مكتبتك", "Meal saved to your library"), "ok");
      router.push(`/chef?recipe=${r.recipe.id}`);
    } catch (e) {
      setErr(errMsg(e));
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title={tr("اطلب وجبة من Healthy AI", "Ask Healthy AI for a meal")}>
      {busy ? (
        <CoachThinking kind="recipe" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">{names.map((n) => (<span key={n} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-800">{n}</span>))}</div>
          <p className="muted">{tr("Healthy AI هيبتكر وجبة جديدة مناسبة لهدفك من المكونات دي، بالسعرات والبروتين والخطوات.", "Healthy AI will create a new meal for your goal from these ingredients, with calories, protein and steps.")}</p>
          <Notice tone="warn" icon="bolt">
            <b>{tr("هيخصم ١ كريدت من رصيدك.", "This uses 1 AI request from your balance.")}</b>{" "}
            {tr(`رصيدك الحالي: ${total}. لو فشل الطلب يرجع الكريدت تلقائيًا.`, `Your balance: ${total}. If it fails, the request is refunded automatically.`)}
          </Notice>
          {err && <Notice tone="bad">{err}</Notice>}
          {!verified ? (
            <Notice tone="warn" icon="shieldCheck">{tr("الميزة دي لحسابات Pi الموثقة (KYC) فقط.", "This needs a KYC-verified Pi account.")}</Notice>
          ) : !accepted ? (
            <Link href="/profile" className="btn-soft w-full">{tr("وافق على التنبيه الصحي أولًا", "Accept the health disclaimer first")}</Link>
          ) : total < 1 ? (
            <div className="flex gap-2"><Link href="/today" className="btn-soft flex-1">{tr("تحدي البداية", "Starter challenge")}</Link><Link href="/pricing" className="btn-sun flex-1">{tr("اشحن طلبات", "Get requests")}</Link></div>
          ) : (
            <button className="btn-primary w-full" onClick={go}>{busy ? <Spinner /> : <Icon name="sparkles" />}{tr("تأكيد — خصم ١ كريدت", "Confirm — use 1 request")}</button>
          )}
        </div>
      )}
    </Sheet>
  );
}
