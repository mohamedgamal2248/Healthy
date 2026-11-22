export type ChallengeSeed = { id: string; type: string; title_ar: string; title_en: string; target_value: number | null; unit: string | null };

// Seed pool for the daily challenges (admin can add / deactivate more from /admin).
export const CHALLENGE_SEEDS: ChallengeSeed[] = [
  { id: "water-8", type: "water", title_ar: "اشرب ٨ أكواب مياه", title_en: "Drink 8 cups of water", target_value: 8, unit: "cups" },
  { id: "water-10", type: "water", title_ar: "اشرب ١٠ أكواب مياه", title_en: "Drink 10 cups of water", target_value: 10, unit: "cups" },
  { id: "steps-7000", type: "steps", title_ar: "امشِ ٧٠٠٠ خطوة", title_en: "Walk 7,000 steps", target_value: 7000, unit: "steps" },
  { id: "steps-10000", type: "steps", title_ar: "امشِ ١٠٠٠٠ خطوة", title_en: "Walk 10,000 steps", target_value: 10000, unit: "steps" },
  { id: "sleep-7", type: "sleep", title_ar: "نم ٧ ساعات على الأقل", title_en: "Sleep at least 7 hours", target_value: 7, unit: "hours" },
  { id: "sleep-8", type: "sleep", title_ar: "نم ٨ ساعات الليلة", title_en: "Sleep 8 hours tonight", target_value: 8, unit: "hours" },
  { id: "no-sugar", type: "no_sugar", title_ar: "يوم بدون سكر مضاف", title_en: "A day with no added sugar", target_value: null, unit: null },
  { id: "no-soda", type: "no_soda", title_ar: "يوم بدون مشروبات غازية", title_en: "A day with no soft drinks", target_value: null, unit: null },
  { id: "veg-every-meal", type: "vegetables", title_ar: "خضار مع كل وجبة", title_en: "Vegetables with every meal", target_value: 3, unit: "meals" },
  { id: "walk-after-lunch", type: "walk", title_ar: "امشِ ١٠ دقائق بعد الغدا", title_en: "Walk 10 minutes after lunch", target_value: 10, unit: "minutes" },
  { id: "no-late-food", type: "no_late_food", title_ar: "بلاش أكل بعد الساعة ٩ مساءً", title_en: "No food after 9 pm", target_value: 21, unit: "hour" },
  { id: "no-fried", type: "no_fried", title_ar: "يوم بدون أكل مقلي", title_en: "A day without fried food", target_value: null, unit: null },
  { id: "fruit-2", type: "fruit", title_ar: "كُل حبتين فاكهة", title_en: "Eat two pieces of fruit", target_value: 2, unit: "pieces" },
  { id: "stretch-5", type: "stretch", title_ar: "٥ دقائق تمدد وحركة خفيفة", title_en: "5 minutes of light stretching", target_value: 5, unit: "minutes" },
  { id: "slow-eating", type: "mindful", title_ar: "كُل ببطء وامضغ جيدًا في وجبة واحدة", title_en: "Eat slowly and chew well at one meal", target_value: 1, unit: "meal" },
  { id: "protein-breakfast", type: "protein", title_ar: "فطار فيه بروتين (بيض أو فول أو قريش)", title_en: "A protein breakfast (eggs, foul or cottage cheese)", target_value: 1, unit: "meal" },
];

// Default weekly group challenges (used only when the admin did not create one for the week).
export const GROUP_DEFAULTS: { challenge_id: string; title_ar: string; title_en: string }[] = [
  { challenge_id: "no-soda", title_ar: "٧ أيام بدون مشروبات غازية", title_en: "7 days with no soft drinks" },
  { challenge_id: "water-8", title_ar: "٧ أيام مياه كفاية: ٨ أكواب يوميًا", title_en: "7 days of 8 cups of water" },
  { challenge_id: "no-sugar", title_ar: "أسبوع بدون سكر مضاف", title_en: "A week with no added sugar" },
  { challenge_id: "walk-after-lunch", title_ar: "أسبوع المشي بعد الغدا", title_en: "A week of post-lunch walks" },
];
