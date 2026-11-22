import { z } from "zod";
import { AiNotConfigured, callModel, extractJson, type AiMessage } from "./provider";
import { outputIsSafe, REFUSAL_AR } from "./safety";
import { MIN_DAILY_KCAL } from "@/config/pricing";
import { langInstruction, type Lang } from "./lang";

export const RecipeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  ingredients: z.array(z.object({ item: z.string().trim().min(1).max(80), quantity: z.string().trim().min(1).max(60) })).min(2).max(25),
  steps: z.array(z.string().trim().min(3).max(400)).min(2).max(15),
  calories: z.number().min(50).max(1500),
  protein: z.number().min(0).max(150),
  benefits: z.array(z.object({ ingredient: z.string().trim().min(1).max(60), benefit: z.string().trim().min(3).max(240) })).min(1).max(8),
  substitutions: z.array(z.object({ missing: z.string().trim().min(1).max(60), use: z.string().trim().min(1).max(120) })).max(8),
  suitable_for: z.array(z.string().trim().min(1).max(40)).max(8),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export class AiUnusable extends Error {}
export class AiRefused extends Error {
  constructor(public message_ar: string) {
    super("refused");
  }
}

export type ProfileContext = { goal: string | null; conditions: string[]; lang?: Lang };

const SHAPE = `{
  "name": "اسم الوصفة",
  "ingredients": [{"item": "المكوّن", "quantity": "الكمية"}],
  "steps": ["الخطوة الأولى", "الخطوة الثانية"],
  "calories": 350,
  "protein": 25,
  "benefits": [{"ingredient": "مكوّن رئيسي", "benefit": "فائدته الصحية العامة"}],
  "substitutions": [{"missing": "مكوّن شائع الغياب", "use": "بديله"}],
  "suitable_for": ["تخسيس", "نباتي"]
}`;

const RULES = `قواعد صارمة:
- أجب بالعربية (لهجة مبسّطة) فقط، واستخدم مكونات رخيصة ومتوفرة في مصر (فول، عدس، بيض، جبنة قريش، خضار موسمية، أرز، فراخ، تونة...) إلا إذا طلب المستخدم غير ذلك.
- أنت تقدّم إرشادات غذائية عامة فقط. ممنوع التشخيص أو العلاج أو ذكر أي دواء أو مكمل غذائي أو جرعة، وممنوع التوصية بالصيام. ممنوع ادعاء أن الأكل يعالج أو يشفي مرضًا.
- إذا طلب المستخدم تشخيصًا أو علاجًا أو نظامًا غذائيًا لطفل، أرجع فقط: {"refusal": "${REFUSAL_AR}"}
- نطاقك الأكل الصحي فقط في هذا الطلب؛ أي طلب خارج الأكل والصحة العامة (برمجة، سياسة، ترجمة…) أرجع فيه فقط: {"refusal": "أنا كوتش للصحة فقط: أكل صحي، تمارين بسيطة، وتحديات وعادات يومية."}
- السعرات والبروتين لحصة واحدة، أرقام واقعية.
- لو الطلب عن طبق أو مكوّن غير مألوف ولا تعرف طريقة تحضيره المعتادة، استخدم أداة البحث على الويب للتأكد من الطريقة، ثم اكتب وصفتك الخاصة بصياغتك (لا تنسخ نصًا من أي موقع).
- أرجع كائن JSON واحدًا فقط بدون أي نص قبله أو بعده.`;

function profileLines(p: ProfileContext): string {
  const lines: string[] = [];
  if (p.goal === "lose") lines.push("هدف المستخدم: تخسيس، فاجعل الوصفة منخفضة السعرات (حوالي ٢٥٠–٤٥٠ سعرة) وعالية الألياف.");
  if (p.goal === "gain") lines.push("هدف المستخدم: بناء عضلات، فاجعل البروتين مرتفعًا.");
  if (p.conditions.includes("diabetes")) lines.push("المستخدم أعلن إصابته بالسكري: تجنب السكريات المضافة والنشويات المكررة الكثيرة.");
  if (p.conditions.includes("hypertension")) lines.push("المستخدم أعلن إصابته بالضغط: قلّل الملح وتجنب المخللات والأجبان المالحة.");
  if (p.conditions.includes("pregnancy")) lines.push("المستخدمة أعلنت الحمل: تجنب الأطعمة النيئة وغير المطهوة جيدًا.");
  return lines.join("\n");
}

export function recipeSystemPrompt(p: ProfileContext): string {
  return `أنت "الكوتش" في تطبيق صحتي لمستخدمي Pi في مصر. تكتب وصفة واحدة كاملة بصيغة JSON بالشكل التالي بالضبط:\n${SHAPE}\n\n${RULES}\n${profileLines(p)}${langInstruction(p.lang ?? "ar")}`;
}

function validate(raw: unknown): Recipe {
  if (raw && typeof raw === "object" && "refusal" in raw) {
    throw new AiRefused(typeof (raw as { refusal: unknown }).refusal === "string" ? ((raw as { refusal: string }).refusal) : REFUSAL_AR);
  }
  const parsed = RecipeSchema.safeParse(raw);
  if (!parsed.success) throw new AiUnusable("schema");
  if (!outputIsSafe(JSON.stringify(parsed.data))) throw new AiUnusable("unsafe_content");
  return parsed.data;
}

/** One generation attempt plus one retry. Throws AiUnusable when both fail (caller refunds the credit). */
export async function generateRecipe(userText: string, profile: ProfileContext): Promise<Recipe> {
  const system = recipeSystemPrompt(profile);
  const messages: AiMessage[] = [{ role: "user", content: userText }];
  let lastErr: unknown;
  const t0 = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && Date.now() - t0 > 35_000) break; // never retry past the time budget
    try {
      const text = await callModel({ system, messages, webSearch: true, maxTokens: 2500 });
      return validate(extractJson(text));
    } catch (e) {
      if (e instanceof AiRefused || e instanceof AiNotConfigured) throw e;
      lastErr = e;
      
    }
  }
  throw new AiUnusable(lastErr instanceof Error ? lastErr.message : "unusable");
}

export async function answerFollowUp(recipe: unknown, history: AiMessage[], question: string, profile: ProfileContext): Promise<string> {
  const system = `أنت "الكوتش" في تطبيق صحتي. المستخدم يسأل عن هذا المحتوى تحديدًا (وصفة أو تمرين أو تحدٍّ):\n${JSON.stringify(recipe)}\n\nأجب بالعربية في فقرة قصيرة وعملية (٣ إلى ٥ جمل). إرشادات غذائية عامة فقط: ممنوع التشخيص أو العلاج أو ذكر دواء أو مكمل أو جرعة أو الصيام. إذا سُئلت عن الأطفال فاذكر معلومة عامة وانصح بسؤال طبيب الأطفال ولا تضع نظامًا لطفل. إذا طُلب منك تشخيص أو علاج اعتذر بلطف.\n${profileLines(profile)}${langInstruction(profile.lang ?? "ar")}`;
  const text = (await callModel({ system, messages: [...history, { role: "user", content: question }], maxTokens: 600 })).trim();
  if (!text || !outputIsSafe(text)) throw new AiUnusable("followup");
  return text;
}

export const MIN_KCAL = MIN_DAILY_KCAL;
