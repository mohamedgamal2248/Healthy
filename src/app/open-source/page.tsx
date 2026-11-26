"use client";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { Icon } from "@/components/Icon";

const REPO = "https://github.com/mohamedgamal2248/Healthy";

/** PiOS page: Healthy is open source under the Pi Open Source (PiOS) license. */
export default function OpenSource() {
  const { tr } = useApp();
  const stack = ["Next.js 16 (App Router)", "TypeScript", "Tailwind CSS v4", "Supabase (Postgres)", "Pi SDK 2.0", "Vercel"];
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <header>
        <h1 className="h1">{tr("مفتوح المصدر (PiOS)", "Open source (PiOS)")}</h1>
        <p className="muted">{tr("Healthy مبني للمجتمع، وكوده متاح تحت رخصة Pi Open Source.", "Healthy is built for the community and its code is available under the Pi Open Source license.")}</p>
      </header>

      <section className="card space-y-2">
        <h2 className="h2 flex items-center gap-2"><Icon name="book" size={20} />{tr("الرخصة", "The license")}</h2>
        <p className="muted !text-base leading-relaxed">{tr("الكود يُنشر برخصة PiOS التي تسمح بالنسخ والتعديل وبناء أعمال مشتقة، بشرط استخدامها لتطوير وتشغيل وتسويق تطبيقات لشبكة Pi الرسمية فقط. الرخصة موجودة كما هي في ملف LICENSE.", "The code is published under the PiOS license. It allows copying, modification and derivative works, solely to develop, use and market applications for the official Pi Network. The license is included unchanged in the LICENSE file.")}</p>
        <ul className="space-y-1 pt-1 text-sm" dir="ltr">
          <li className="chip select-all break-all">{REPO}</li>
          <li className="chip select-all break-all">https://github.com/pi-apps/PiOS</li>
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="h2">{tr("التقنيات المستخدمة", "Built with")}</h2>
        <ul className="flex flex-wrap gap-2">{stack.map((s) => <li key={s} className="chip" dir="ltr">{s}</li>)}</ul>
      </section>

      <section className="card space-y-2">
        <h2 className="h2">{tr("كيف يرتبط بـ Pi", "How it uses Pi")}</h2>
        <ul className="muted list-disc space-y-1 !text-base ps-5">
          <li>{tr("تسجيل الدخول بحساب Pi، والتحقق من الهوية يتم على الخادم.", "Sign-in with Pi; identity is verified on the server.")}</li>
          <li>{tr("مدفوعات Pi من المستخدم إلى التطبيق (U2A) فقط، وتُتحقق على الخادم قبل منح أي شيء.", "User-to-app (U2A) Pi payments only, verified on the server before anything is granted.")}</li>
          <li>{tr("لا حفظ لأي بيانات اعتماد Pi، ولا طلب لعبارة الاسترداد أبدًا.", "No Pi credentials are stored and the passphrase is never requested.")}</li>
        </ul>
      </section>

      <p className="text-xs font-bold text-ink-soft" dir="ltr">Pi, Pi Network and the Pi logo are trademarks of the Pi Community Company.</p>
      <Link href="/" className="text-sm font-extrabold text-brand-700">{tr("العودة للرئيسية", "Back to home")}</Link>
    </div>
  );
}
