"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { useApp } from "./AppProvider";
import { TagChips } from "./MealCard";
import { PricingGrid, type PriceItem } from "./Pricing";
import { Spinner, DevLogin } from "./ui";
import type { MealSeed } from "@/data/meals";
import type { ChallengeSeed } from "@/data/challenges";

export function Landing({ items, trial, meal, challenge, ingredientsEn }: { items: PriceItem[]; trial: number; meal: MealSeed; challenge: ChallengeSeed; ingredientsEn?: { item: string }[] }) {
  const { tr, lang, me, signIn, signingIn, devSignIn } = useApp();
  const steps = [
    { icon: "check", ar: "تحدي كل يوم", en: "A challenge every day", d_ar: "٣ تحديات صغيرة تبني عادة صحية وتحافظ على سلسلتك.", d_en: "Three small challenges that build habits and keep your streak alive." },
    { icon: "utensils", ar: "وجبات مصرية رخيصة", en: "Affordable meals", d_ar: "فطار وغدا وعشا من فول وعدس وبيض وقريش، بالسعرات والتكلفة.", d_en: "Breakfast, lunch and dinner from foul, lentils, eggs and cottage cheese, with calories and cost." },
    { icon: "chef", ar: "شيف ذكاء اصطناعي", en: "AI Coach", d_ar: "اكتب اللي عندك في البيت واحصل على وصفة كاملة بكريدت واحد.", d_en: "Ask for a meal, a workout or a 7-day challenge and get a complete, personal answer for 1 request." },
    { icon: "plan", ar: "نظام غذائي شخصي", en: "A personal diet plan", d_ar: "خطة أسبوعية من ملفك الصحي تتجدد مع وزنك.", d_en: "A weekly plan from your own profile that updates with your weight." },
  ];
  return (
    <div>
      <section className="relative -mx-4 overflow-hidden bg-gradient-to-b from-brand-100 via-brand-50 to-canvas px-4 pb-10 pt-8 sm:pt-14">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-brand-700 shadow-sm"><Icon name="shieldCheck" size={16} />{tr("لبايونيرز Pi الموثّقين", "For verified Pi Pioneers")}</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.25] text-brand-900 sm:text-5xl">{tr("صحتك تبدأ بتحدي صغير كل يوم", "Your health starts with one small challenge a day")}</h1>
            <p className="mt-4 max-w-xl text-lg font-semibold text-ink-soft">{tr("تحديات يومية، وجبات صحية من مكونات رخيصة، وشيف ذكاء اصطناعي ونظام غذائي شخصي. ادفع بـ Pi فقط لما تحتاج الخدمات المدفوعة.", "Daily challenges, healthy meals from affordable ingredients, an AI coach for meals, workouts and challenges, and a personal diet plan. Pay with Pi only when you want the paid services.")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {me ? (
                <Link href="/today" className="btn-primary"><Icon name="home" />{tr("كمّل تحدي اليوم", "Continue today")}</Link>
              ) : (
                <button className="btn-primary" onClick={signIn} disabled={signingIn}>{signingIn ? <Spinner /> : <Icon name="pi" />}{tr("ابدأ بتسجيل الدخول بـ Pi", "Start with Pi sign-in")}</button>
              )}
              <a href="#pricing" className="btn-soft">{tr("الأسعار", "Pricing")}</a>
            </div>
            {!me && <div className="mt-3"><DevLogin onLogin={devSignIn} /></div>}
            <p className="mt-3 text-sm font-semibold text-ink-soft">{tr("تسجيل الدخول بحساب Pi فقط، بدون إيميل أو كلمة مرور. يعمل داخل Pi Browser.", "Sign-in is with your Pi account only: no email, no password. Works inside Pi Browser.")}</p>
          </div>

          <div className="mx-auto w-full max-w-md space-y-3">
            <div className="card flex items-center gap-3 !p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><Icon name="drop" size={26} /></span>
              <div className="flex-1"><p className="text-xs font-extrabold text-ink-soft">{tr("مثال: تحدي اليوم", "Sample: today's challenge")}</p><p className="font-extrabold">{lang === "ar" ? challenge.title_ar : challenge.title_en}</p></div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-brand-300 text-brand-600"><Icon name="check" size={24} /></span>
            </div>
            <div className="card !p-0">
              <div className="space-y-2 p-4">
                <p className="text-xs font-extrabold text-ink-soft">{tr("مثال: وجبة اليوم", "Sample: meal of the day")}</p>
                <p className="font-extrabold">{lang === "ar" ? meal.name_ar : meal.name_en}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-ink-soft">
                  <span className="inline-flex items-center gap-1"><Icon name="flame" size={15} className="text-sun-500" />{meal.calories} {tr("سعرة", "kcal")}</span>
                  <span className="inline-flex items-center gap-1"><Icon name="bolt" size={15} className="text-brand-600" />{meal.protein_g} {tr("جم بروتين", "g protein")}</span>
                </div>
                <p className="text-sm font-semibold"><span className="text-ink-soft">{tr("المكونات: ", "Ingredients: ")}</span>{(lang === "en" && ingredientsEn ? ingredientsEn : meal.ingredients).map((i) => i.item).join(tr("، ", ", "))}</p>
                <TagChips tags={meal.tags} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl py-10">
        <h2 className="h1 mb-6 text-center">{tr("كيف يعمل صحتي؟", "How Healthy works")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.icon} className="card">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon name={s.icon} size={26} /></span>
              <p className="mt-3 text-xs font-extrabold text-brand-600">{tr(`الخطوة ${i + 1}`, `Step ${i + 1}`)}</p>
              <h3 className="text-lg font-extrabold">{tr(s.ar, s.en)}</h3>
              <p className="muted mt-1">{tr(s.d_ar, s.d_en)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 py-10">
        <h2 className="h1 text-center">{tr("الأسعار", "Pricing")}</h2>
        <p className="muted mx-auto mb-8 mt-2 max-w-xl text-center">{tr("الخدمات تُدفع من محفظتك إلى التطبيق مباشرة وتُفعّل فورًا بعد التحقق. لا توجد اشتراكات تتجدد تلقائيًا.", "Services are paid from your wallet straight to the app and activate right after verification. Nothing renews automatically.")}</p>
        <PricingGrid items={items} trial={trial} />
        <div className="mt-6 text-center"><Link href="/pricing" className="btn-soft">{tr("تفاصيل الباقات", "Plan details")}<Icon name="arrowL" size={18} className="rtl:hidden" /></Link></div>
      </section>

      <p className="mx-auto max-w-2xl border-t border-line py-6 text-center text-xs font-semibold text-ink-soft">{tr("نصائح غذائية عامة، وليست تشخيصًا طبيًا أو بديلًا عن استشارة الطبيب", "General nutrition guidance, not a medical diagnosis or a substitute for consulting a doctor.")}</p>
    </div>
  );
}
