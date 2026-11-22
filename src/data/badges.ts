export type BadgeDef = { key: string; ar: string; en: string; desc_ar: string; desc_en: string; icon: string };

// Display-only reputation badges. They carry no Pi value.
export const BADGES: BadgeDef[] = [
  { key: "streak_7", ar: "أسبوع كامل", en: "Full week", desc_ar: "٧ أيام متتالية من التحديات", desc_en: "7 days in a row", icon: "flame" },
  { key: "streak_30", ar: "شهر من الالتزام", en: "30-day streak", desc_ar: "٣٠ يومًا متتاليًا", desc_en: "30 days in a row", icon: "medal" },
  { key: "streak_100", ar: "بطل المئة", en: "100-day hero", desc_ar: "١٠٠ يوم متتالي", desc_en: "100 days in a row", icon: "trophy" },
  { key: "sugar_hero", ar: "بطل السكر", en: "Sugar hero", desc_ar: "٧ أيام بدون سكر مضاف", desc_en: "7 sugar-free days", icon: "shield" },
  { key: "water_champ", ar: "بطل المياه", en: "Water champ", desc_ar: "١٠ أيام من تحديات المياه", desc_en: "10 water challenges done", icon: "drop" },
  { key: "walker", ar: "ماشي نشيط", en: "Active walker", desc_ar: "١٠ أيام من تحديات المشي", desc_en: "10 walking challenges done", icon: "steps" },
  { key: "group_finisher", ar: "أكمل التحدي الجماعي", en: "Group finisher", desc_ar: "٧ أيام في تحدي الأسبوع", desc_en: "7 days in a weekly group challenge", icon: "users" },
];
