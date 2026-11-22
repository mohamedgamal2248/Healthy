"use client";
import type { ReactNode } from "react";
import { useApp } from "./AppProvider";

export function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const { tr } = useApp();
  const H = ({ children }: { children: ReactNode }) => <h2 className="h2 mb-1 mt-6">{children}</h2>;
  const P = ({ children }: { children: ReactNode }) => <p className="muted !text-base leading-relaxed">{children}</p>;
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="h1 mb-1">{kind === "terms" ? tr("الشروط والأحكام", "Terms of Use") : tr("سياسة الخصوصية", "Privacy Policy")}</h1>
      <p className="muted">{tr("آخر تحديث: نوفمبر 2026", "Last updated: November 2026")}</p>
      {kind === "terms" ? (
        <>
          <H>{tr("ما هي الخدمة", "The service")}</H>
          <P>{tr("Healthy تطبيق لتحديات صحية يومية ووجبات وذكاء اصطناعي ونظام غذائي، لمستخدمي Pi. المحتوى إرشادات غذائية ونمط حياة عامة، وليس تشخيصًا طبيًا أو بديلًا عن استشارة الطبيب.", "Healthy offers daily health challenges, meals, Healthy AI and diet plans for Pi users. Content is general nutrition and lifestyle guidance, not a medical diagnosis or a substitute for a doctor.")}</P>
          <H>{tr("الحساب", "Your account")}</H>
          <P>{tr("الدخول بحساب Pi فقط. بعض الميزات (الشراء وAI والمجتمع) تتطلب حساب Pi موثّقًا (KYC). أنت مسؤول عن نشاط حسابك.", "Sign-in is with your Pi account only. Some features (purchases, Healthy AI, community) require a KYC-verified Pi account. You are responsible for activity on your account.")}</P>
          <H>{tr("المدفوعات", "Payments")}</H>
          <P>{tr("المدفوعات بعملة Pi من محفظتك إلى التطبيق مقابل خدمة رقمية (طلبات ذكاء اصطناعي، خطة شهرية). السعر يُحسب بالدولار ويُحوَّل إلى Pi بسعر السوق اللحظي ويُقرَّب لأعلى لرقم صحيح، ويُثبَّت 30 دقيقة عند الشراء. الخطة الشهرية دفعة واحدة لمدة 30 يومًا وبدون تجديد تلقائي. كريدت الباقات لا ينتهي، وكريدت الخطة ينتهي بنهايتها. لا يوجد سحب أو تحويل Pi بين المستخدمين.", "Payments are in Pi from your wallet to the app for a digital service (AI requests, monthly plan). Prices are set in USD, converted to Pi at the live market rate and rounded up to a whole Pi, locked for 30 minutes at purchase. The monthly plan is a single payment for 30 days with no automatic renewal. Pack credits never expire; plan credits expire with the plan. There are no withdrawals or Pi transfers between users.")}</P>
          <H>{tr("الاستخدام العادل", "Fair use")}</H>
          <P>{tr("لحماية الخدمة نضع حدودًا على عدد طلبات الذكاء الاصطناعي في الساعة واليوم. نحتفظ بحق تقييد أي استخدام مسيء أو آلي. الطلبات الفاشلة أو المرفوضة يُعاد كريدتها تلقائيًا.", "To protect the service we limit AI requests per hour and per day. We may restrict abusive or automated use. Failed or refused requests are refunded automatically.")}</P>
          <H>{tr("حدود المسؤولية", "Limits")}</H>
          <P>{tr("الخدمة مقدّمة كما هي. لا نضمن نتائج صحية. استشر طبيبك قبل أي تغيير غذائي أو رياضي، خصوصًا مع السكري أو الضغط أو الحمل.", "The service is provided as is. We do not guarantee health outcomes. Consult your doctor before any dietary or exercise change, especially with diabetes, hypertension or pregnancy.")}</P>
        </>
      ) : (
        <>
          <H>{tr("ما نجمعه", "What we collect")}</H>
          <P>{tr("اسم مستخدم Pi، وحالة التوثيق. وما تدخله بنفسك: العمر والنوع والوزن والطول والهدف ومستوى النشاط والحالات الصحية التي تختار إعلانها، وسجل الوزن والعادات، والتحديات المنجزة، والوصفات والطلبات من Healthy AI.", "Your Pi username and verification status; and what you enter yourself: age, sex, weight, height, goal, activity level, any health conditions you choose to declare, weight and habit logs, completed challenges, and Healthy AI requests and results.")}</P>
          <H>{tr("كيف نستخدمها", "How we use it")}</H>
          <P>{tr("لتخصيص الأهداف والنظام الغذائي والتحديات، ولتشغيل الدفع والكريدت، ولمنع الاستغلال. لا نبيع بياناتك.", "To personalise goals, plans and challenges, to run payments and credits, and to prevent abuse. We do not sell your data.")}</P>
          <H>{tr("الذكاء الاصطناعي", "AI")}</H>
          <P>{tr("عند طلب Healthy AI نرسل نص طلبك وهدفك والحالات الصحية التي أعلنتها فقط (وليس وزنك أو عمرك) إلى مزوّد النموذج لإنتاج الإجابة. قد يُستخدم البحث على الويب لطبق غير مألوف. نحتفظ بنتائج مخزّنة مؤقتًا لتقليل التكلفة.", "When you use Healthy AI we send your request text, your goal and any declared conditions only (not your weight or age) to the model provider to produce the answer. Web search may be used for unfamiliar dishes. Results are cached to reduce cost. If you use the meal-photo scan, the photo is sent to the provider only to produce the estimate and is not stored by us; only the text result is saved to your library.")}</P>
          <H>{tr("خصوصية بياناتك الصحية", "Health data privacy")}</H>
          <P>{tr("وزنك وحالتك الصحية ونظامك الغذائي تظهر لك وحدك. لا تظهر في المجتمع ولا في لوحة المتصدرين ولا في الوصفات المشاركة ولا للإدارة (إجماليات فقط).", "Your weight, conditions and diet plans are visible only to you. They never appear in the community, leaderboards, shared recipes or to admins (aggregate totals only).")}</P>
          <H>{tr("حقوقك", "Your rights")}</H>
          <P>{tr("من صفحة ملفي الصحي يمكنك تحميل بياناتك أو حذف حسابك وبياناتك. سجلات الدفع والكريدت تبقى كسجل مالي بدون بيانات شخصية.", "From your health profile page you can download your data or delete your account and data. Payment and credit records remain as a financial record without personal data.")}</P>
        </>
      )}
    </div>
  );
}
