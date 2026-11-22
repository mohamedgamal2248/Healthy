import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCompletion, effectiveStreak, streakBadges } from "../src/lib/streak";
import { addDays, weekStart, localDate } from "../src/lib/dates";
import { dailyCalories, clampCalories, weeklyAdjustment } from "../src/lib/nutrition";
import { buildWeekPlan } from "../src/lib/planner";
import { MEAL_SEEDS } from "../src/data/meals";
import { paymentMismatch, memoFor, completedProperly } from "../src/server/payment-verify";
import { isRefusalRequest, outputIsSafe } from "../src/server/ai/safety";
import { RecipeSchema } from "../src/server/ai/recipe";
import { PRICING } from "../src/config/pricing";
import { signSession, verifySession } from "../src/server/session";
import { CHALLENGE_SEEDS } from "../src/data/challenges";

test("streak: consecutive days grow, same day doesn't, a gap resets and reads 0 after a missed day", () => {
  let s = { current: 0, longest: 0, last: null as string | null, total: 0 };
  s = applyCompletion(s, "2026-11-01");
  s = applyCompletion(s, "2026-11-01");
  assert.equal(s.current, 1); assert.equal(s.total, 2);
  s = applyCompletion(s, "2026-11-02");
  assert.equal(s.current, 2);
  assert.equal(effectiveStreak(s, "2026-11-03"), 2); // yesterday done, today pending
  assert.equal(effectiveStreak(s, "2026-11-04"), 0); // a missed day broke it
  s = applyCompletion(s, "2026-11-05");
  assert.equal(s.current, 1); assert.equal(s.longest, 2);
  assert.deepEqual(streakBadges(30), ["streak_7", "streak_30"]);
});

test("local day rolls over at local midnight in the user's timezone", () => {
  const t = new Date("2026-11-22T22:30:00Z"); // 00:30 next day in Cairo (UTC+2)
  assert.equal(localDate("Africa/Cairo", t), "2026-11-23");
  assert.equal(localDate("UTC", t), "2026-11-22");
  assert.equal(weekStart("2026-11-21"), "2026-11-21"); // Saturday
  assert.equal(weekStart("2026-11-27"), "2026-11-21"); // Friday
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
});

test("calories never go below 1,200 even for aggressive inputs", () => {
  const small = { weightKg: 45, heightCm: 150, age: 60, sex: "female" as const, goal: "lose" as const, activity: "low" as const, conditions: [] as string[], adjustment: -300 };
  assert.ok(dailyCalories(small) >= 1200);
  assert.equal(clampCalories(900), 1200);
  assert.ok(dailyCalories({ ...small, conditions: ["pregnancy"] }) >= 1200);
  assert.ok(weeklyAdjustment("lose", 80, 80, 0) < 0);
  assert.ok(weeklyAdjustment("lose", 80, 80, -300) >= -300);
});

test("catalogue: 110 meals (30+40 Egyptian, 40 international), no emoji, no forbidden words, keys valid", async () => {
  assert.equal(MEAL_SEEDS.length, 110);
  assert.equal(MEAL_SEEDS.filter((m) => m.cuisine === "egyptian").length, 70);
  assert.equal(MEAL_SEEDS.filter((m) => m.cuisine === "international").length, 40);
  const forbidden = ["خنزير", "نبيذ", "كحول", "حلال", "حرام", "halal", "haram", "pork", "bacon", "wine", "beer", "mirin", "sake", "gelatin"];
  for (const m of MEAL_SEEDS) { const words = JSON.stringify(m).toLowerCase().split(/[^\p{L}]+/u); for (const f of forbidden) assert.ok(!words.includes(f), `${m.id}: ${f}`); }
  const { INGREDIENT_MAP } = await import("../src/data/ingredients");
  for (const m of MEAL_SEEDS) for (const i of m.ingredients) if (i.key) assert.ok(INGREDIENT_MAP[i.key], `${m.id}: ${i.key}`);
  const emoji = /\p{Extended_Pictographic}/u;
  for (const m of MEAL_SEEDS) {
    assert.ok(m.steps.length >= 3 && m.ingredients.length >= 3 && m.calories > 0 && m.protein_g > 0, m.id);
    assert.ok(!emoji.test(JSON.stringify(m)), m.id);
  }
  assert.equal(new Set(MEAL_SEEDS.map((m) => m.id)).size, 110);
  assert.ok(CHALLENGE_SEEDS.length >= 14);
});

test("week plan: 7 days x 3 meals, respects condition tags and 1,200 floor", () => {
  const meals = MEAL_SEEDS.map((m) => ({ id: m.id, meal_type: m.meal_type, name_ar: m.name_ar, name_en: m.name_en, calories: m.calories, protein_g: m.protein_g, tags: m.tags as string[] }));
  const r = buildWeekPlan({ meals, calorieTarget: 800, conditions: ["diabetes", "hypertension"], goal: "lose", weekStart: "2026-11-21", seed: "u" });
  assert.equal(r.calorieTarget, 1200);
  assert.equal(r.days.length, 7);
  for (const d of r.days) for (const s of d.slots) {
    const m = meals.find((x) => x.id === s.meal_id)!;
    assert.ok(m.tags.includes("diabetes_friendly") && m.tags.includes("low_salt"), m.id);
  }
});

const purchase = { id: "11111111-1111-1111-1111-111111111111", username: "alice", kind: "pack" as const, item_key: "pack_small", amount_pi: 12, pi_payment_id: null, created_at: new Date().toISOString() };
const pay = (over: Record<string, unknown> = {}) => ({ identifier: "P1", user_uid: "uid-a", amount: 12, memo: memoFor("pack_small"), direction: "user_to_app", status: { developer_approved: true, transaction_verified: true, developer_completed: false, cancelled: false, user_cancelled: false }, transaction: { txid: "TX", verified: true }, ...over }) as never;

test("payment verification rejects wrong amount / payer / memo / cancelled / direction", () => {
  assert.equal(paymentMismatch(pay(), purchase, "uid-a"), null);
  assert.equal(paymentMismatch(pay({ amount: 0.5 }), purchase, "uid-a"), "wrong_amount");
  assert.equal(paymentMismatch(pay(), purchase, "uid-b"), "wrong_payer");
    assert.equal(paymentMismatch(pay({ memo: memoFor("plan_monthly") }), purchase, "uid-a"), "wrong_memo");
  assert.equal(paymentMismatch(pay({ direction: "app_to_user" }), purchase, "uid-a"), "wrong_direction");
  assert.equal(paymentMismatch(pay({ status: { cancelled: true } }), purchase, "uid-a"), "cancelled");
  assert.equal(paymentMismatch(pay(), { ...purchase, amount_pi: 0.1 }, "uid-a"), "bad_quote"); // quotes are whole Pi >= 1
  assert.equal(paymentMismatch(pay(), { ...purchase, created_at: new Date(Date.now() - 31 * 60_000).toISOString() }, "uid-a"), "quote_expired");
  assert.equal(completedProperly(pay({ status: { developer_completed: true, cancelled: false } }), "TX"), true);
  assert.equal(completedProperly(pay(), "TX"), false); // not completed yet
  assert.equal(PRICING.plan_monthly.days, 30);
});

test("AI safety: refuses diagnosis / treatment / child plans; blocks supplements and fasting in output", () => {
  assert.ok(isRefusalRequest("اعمللي دايت لابني عنده 6 سنين"));
  assert.ok(isRefusalRequest("شخصلي حالتي وقولي العلاج"));
  assert.ok(isRefusalRequest("what dosage of supplement should I take"));
  assert.ok(!isRefusalRequest("عندي بيض وجبنة قريش وطماطم"));
  assert.ok(!isRefusalRequest("عايز غدا بـ 300 سعرة وبروتين عالي"));
  assert.ok(!isRefusalRequest("أقلل الملح إزاي؟"));
  assert.ok(!outputIsSafe("خذ مكمل فيتامين د"));
  assert.ok(!outputIsSafe("جرّب الصيام المتقطع"));
  assert.ok(outputIsSafe("أضف الطماطم والبصل وقلّب"));
});

test("AI recipe schema validates the fixed JSON shape", () => {
  const good = { name: "أومليت", ingredients: [{ item: "بيض", quantity: "2" }, { item: "طماطم", quantity: "1" }], steps: ["اخفق البيض", "اطهه"], calories: 250, protein: 15, benefits: [{ ingredient: "بيض", benefit: "بروتين كامل" }], substitutions: [{ missing: "شوفان", use: "فول" }], suitable_for: ["تخسيس"] };
  assert.ok(RecipeSchema.safeParse(good).success);
  assert.ok(!RecipeSchema.safeParse({ ...good, steps: [] }).success);
  assert.ok(!RecipeSchema.safeParse({ ...good, calories: "250" }).success);
});

test("session tokens are signed and tamper-evident", () => {
  process.env.SESSION_SECRET = "x".repeat(40);
  const t = signSession("alice", "uid-a");
  assert.equal(verifySession(t)?.u, "alice");
  const forged = Buffer.from(JSON.stringify({ u: "bobby", uid: "uid-a", exp: 9999999999 })).toString("base64url") + "." + t.split(".")[1];
  assert.equal(verifySession(forged), null);
  assert.equal(verifySession(t.slice(0, -2) + "AA"), null);
  assert.equal(verifySession(null), null);
});

import { recipeCacheKey } from "../src/server/chef";
import { callModel, MAX_INPUT_TOKENS_ESTIMATE } from "../src/server/ai/provider";

test("AI cache key is stable across punctuation/spacing and differs by goal/conditions", () => {
  const a = recipeCacheKey("عندي بيض  وجبنة قريش!", "lose", ["diabetes"]);
  assert.equal(a, recipeCacheKey("عندي بيض وجبنة قريش", "lose", ["diabetes"]));
  assert.notEqual(a, recipeCacheKey("عندي بيض وجبنة قريش", "gain", ["diabetes"]));
  assert.notEqual(a, recipeCacheKey("عندي بيض وجبنة قريش", "lose", []));
});

test("oversized AI input is refused before any request is made", async () => {
  process.env.AI_API_KEY = "k"; process.env.AI_PROVIDER = "meta";
  await assert.rejects(callModel({ system: "x".repeat(MAX_INPUT_TOKENS_ESTIMATE * 2 + 10), messages: [{ role: "user", content: "hi" }] }), /input too large/);
});

import { usdToPi } from "../src/server/pi-price";
test("USD -> Pi rounds UP to a whole Pi and never below 1", () => {
  assert.equal(usdToPi(0.6, 0.05411), 12); // 11.09 -> 12
  assert.equal(usdToPi(2, 0.05411), 37); // 36.96 -> 37
  assert.equal(usdToPi(1.5, 0.75), 2); // 2.0 exactly -> 2, 1.5 Pi would also round to 2
  assert.equal(usdToPi(1.5, 1), 2);
  assert.equal(usdToPi(0.001, 5), 1);
});

import { detectLang, langInstruction } from "../src/server/ai/lang";
test("AI answers in the language the user wrote in", () => {
  assert.equal(detectLang("I have eggs and tomatoes", "ar"), "en");
  assert.equal(detectLang("عندي بيض وطماطم", "en"), "ar");
  assert.equal(detectLang("eggs وطماطم وبيض", "en"), "ar");
  assert.equal(detectLang("123", "en"), "en");
  assert.match(langInstruction("en"), /ENGLISH/);
  assert.notEqual(recipeCacheKey("eggs", null, [], "recipe", "en"), recipeCacheKey("eggs", null, [], "recipe", "ar"));
});

import { MEALS_EN } from "../src/data/meals-en";
test("every catalogue meal has English ingredients and steps matching the Arabic structure", () => {
  const bad = /pork|bacon|wine|beer|mirin|sake|gelatin|halal|haram/i;
  for (const m of MEAL_SEEDS) {
    const en = MEALS_EN[m.id];
    assert.ok(en, `missing EN for ${m.id}`);
    assert.equal(en.ingredients.length, m.ingredients.length, m.id);
    assert.equal(en.steps.length, m.steps.length, m.id);
    assert.ok(!/[\u0600-\u06FF]/.test(JSON.stringify(en)), `Arabic left in EN for ${m.id}`);
    assert.ok(!bad.test(JSON.stringify(en)), m.id);
  }
});
