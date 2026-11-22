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

test("catalogue: 30 meals, 10 per type, Arabic, no emoji, ingredient keys valid", () => {
  assert.equal(MEAL_SEEDS.length, 30);
  for (const t of ["breakfast", "lunch", "dinner"]) assert.equal(MEAL_SEEDS.filter((m) => m.meal_type === t).length, 10);
  const emoji = /\p{Extended_Pictographic}/u;
  for (const m of MEAL_SEEDS) {
    assert.ok(m.steps.length >= 3 && m.ingredients.length >= 3 && m.calories > 0 && m.protein_g > 0, m.id);
    assert.ok(!emoji.test(JSON.stringify(m)), m.id);
  }
  assert.equal(new Set(MEAL_SEEDS.map((m) => m.id)).size, 30);
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

const purchase = { id: "11111111-1111-1111-1111-111111111111", username: "alice", kind: "pack" as const, item_key: "pack_small", amount_pi: 1, pi_payment_id: null };
const pay = (over: Record<string, unknown> = {}) => ({ identifier: "P1", user_uid: "uid-a", amount: 1, memo: memoFor("pack", purchase.id), direction: "user_to_app", status: { developer_approved: true, transaction_verified: true, developer_completed: false, cancelled: false, user_cancelled: false }, transaction: { txid: "TX", verified: true }, ...over }) as never;

test("payment verification rejects wrong amount / payer / memo / cancelled / direction", () => {
  assert.equal(paymentMismatch(pay(), purchase, "uid-a"), null);
  assert.equal(paymentMismatch(pay({ amount: 0.5 }), purchase, "uid-a"), "wrong_amount");
  assert.equal(paymentMismatch(pay(), purchase, "uid-b"), "wrong_payer");
  assert.equal(paymentMismatch(pay({ memo: memoFor("pack", "22222222-2222-2222-2222-222222222222") }), purchase, "uid-a"), "wrong_memo");
  assert.equal(paymentMismatch(pay({ memo: memoFor("plan", purchase.id) }), purchase, "uid-a"), "wrong_memo");
  assert.equal(paymentMismatch(pay({ direction: "app_to_user" }), purchase, "uid-a"), "wrong_direction");
  assert.equal(paymentMismatch(pay({ status: { cancelled: true } }), purchase, "uid-a"), "cancelled");
  assert.equal(paymentMismatch(pay(), { ...purchase, amount_pi: 0.1 }, "uid-a"), "stale_price"); // row tampered with
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
