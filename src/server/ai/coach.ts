import { z } from "zod";
import { callModel, extractJson, AiNotConfigured } from "./provider";
import { outputIsSafe, REFUSAL_AR } from "./safety";
import { AiRefused, AiUnusable, type ProfileContext } from "./recipe";
import { langInstruction } from "./lang";

export type CoachKind = "recipe" | "workout" | "challenge";
export const COACH_KINDS: CoachKind[] = ["recipe", "workout", "challenge"];
export const isCoachKind = (k: unknown): k is CoachKind => typeof k === "string" && (COACH_KINDS as string[]).includes(k);

/** Workout / challenge output: a structured card of titled sections. */
export const CardSchema = z.object({
  name: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(5).max(400),
  level: z.string().trim().max(40).optional().default(""),
  duration_min: z.number().min(1).max(180).optional(),
  sections: z.array(z.object({ heading: z.string().trim().min(1).max(80), items: z.array(z.string().trim().min(2).max(300)).min(1).max(10) })).min(1).max(8),
  tips: z.array(z.string().trim().min(3).max(240)).max(6).default([]),
});
export type Card = z.infer<typeof CardSchema>;

export const OFFTOPIC_AR = "أنا كوتش للصحة فقط: أكل صحي، تمارين بسيطة، وتحديات وعادات يومية. جرّب طلبًا في هذه المجالات.";

const SHAPE = `{
  "name": "عنوان قصير",
  "summary": "جملة أو جملتان",
  "level": "مبتدئ",
  "duration_min": 20,
  "sections": [{"heading": "الإحماء", "items": ["تمرين أو خطوة 1", "تمرين أو خطوة 2"]}],
  "tips": ["نصيحة عملية"]
}`;

const COMMON = `قواعد صارمة:
- أجب بالعربية المبسّطة فقط. أنت كوتش صحي عام داخل تطبيق Healthy لمستخدمي Pi في مصر.
- نطاقك فقط: الأكل الصحي، التمارين المنزلية البسيطة، التحديات والعادات اليومية (مياه، نوم، خطوات). أي طلب خارج هذا النطاق: أرجع فقط {"refusal": "${OFFTOPIC_AR}"}
- ممنوع التشخيص أو العلاج أو علاج الإصابات أو التأهيل الطبي أو ذكر أي دواء أو مكمل أو جرعة، وممنوع الصيام، وممنوع ادعاء الشفاء من أي مرض. لو طُلب شيء من ذلك أرجع {"refusal": "${REFUSAL_AR}"}
- لا تضع خطة لطفل. أرجع كائن JSON واحدًا فقط بدون أي نص قبله أو بعده.`;

function profileNotes(p: ProfileContext) {
  const l: string[] = [];
  if (p.goal === "lose") l.push("هدف المستخدم تخسيس: ركّز على الحركة الخفيفة والالتزام.");
  if (p.goal === "gain") l.push("هدف المستخدم بناء عضلات.");
  if (p.conditions.includes("pregnancy")) l.push("المستخدمة حامل: اجعل النشاط خفيفًا جدًا وبدون تمارين مجهدة أو على البطن أو بالاستلقاء المطوّل.");
  if (p.conditions.includes("hypertension") || p.conditions.includes("diabetes")) l.push("المستخدم أعلن حالة صحية مزمنة: اجعل الشدة منخفضة إلى متوسطة وانصح بالتوقف عند أي تعب غير معتاد.");
  return l.join("\n");
}

export function cardSystemPrompt(kind: Exclude<CoachKind, "recipe">, p: ProfileContext): string {
  const task =
    kind === "workout"
      ? "اكتب برنامج تمرين منزلي عام واحد للمبتدئين: أقسام (إحماء، تمارين رئيسية بعدد التكرارات أو الزمن وفترات الراحة، تهدئة). بدون أجهزة، وآمن، وانصح بالتوقف عند الألم أو الدوخة."
      : "اكتب تحدّي صحيًا مخصصًا لمدة ٧ أيام: قسم لكل مرحلة أو أيام، وبنود صغيرة قابلة للتنفيذ يوميًا (مياه، حركة، نوم، أكل)، وكيف يتابع المستخدم تقدمه.";
  return `أنت "الكوتش" في تطبيق Healthy. ${task}\nأرجع JSON بالشكل التالي بالضبط:\n${SHAPE}\n\n${COMMON}\n${profileNotes(p)}${langInstruction(p.lang ?? "ar")}`;
}

export async function generateCard(kind: Exclude<CoachKind, "recipe">, userText: string, profile: ProfileContext): Promise<Card> {
  const system = cardSystemPrompt(kind, profile);
  let last: unknown;
  const t0 = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && Date.now() - t0 > 35_000) break; // never retry past the time budget
    try {
      const text = await callModel({ system, messages: [{ role: "user", content: userText }], maxTokens: 2200 });
      const raw = extractJson(text) as { refusal?: unknown };
      if (raw && typeof raw === "object" && "refusal" in raw) throw new AiRefused(typeof raw.refusal === "string" ? raw.refusal : OFFTOPIC_AR);
      const parsed = CardSchema.safeParse(raw);
      if (!parsed.success) throw new AiUnusable("schema");
      if (!outputIsSafe(JSON.stringify(parsed.data))) throw new AiUnusable("unsafe_content");
      return parsed.data;
    } catch (e) {
      if (e instanceof AiRefused || e instanceof AiNotConfigured) throw e;
      last = e;
    }
  }
  throw new AiUnusable(last instanceof Error ? last.message : "unusable");
}
