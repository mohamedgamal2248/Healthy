import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCompletion, effectiveStreak, streakBadges } from "../src/lib/streak";
import { addDays, weekStart, localDate } from "../src/lib/dates";
import { dailyCalories, clampCalories, weeklyAdjustment } from "../src/lib/nutrition";
import { buildWeekPlan } from "../src/lib/planner";
import { MEAL_SEEDS } from "../src/data/meals";
import { paymentMismatch, memoFor, completedProperly } from "../src/server/payment-verify";
import { isRefusalRequest, normalizeText, outputIsSafe } from "../src/server/ai/safety";
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
  const old = { ...purchase, created_at: new Date(Date.now() - 31 * 60_000).toISOString() };
  assert.equal(paymentMismatch(pay(), old, "uid-a", { enforceTtl: true }), "quote_expired"); // opening a payment on a stale quote
  assert.equal(paymentMismatch(pay(), old, "uid-a"), null); // an already-paid payment must still be grantable
  assert.equal(normalizeText("تَشـخيص"), "تشخيص");
  assert.equal(isRefusalRequest("meal plan for my kid"), true);
  assert.equal(isRefusalRequest("طفلي عايز رجيم"), true);
  assert.equal(isRefusalRequest("quick chicken lunch"), false);
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

import { scanInconsistency, validImage, scanSystemPrompt, ScanSchema } from "../src/server/ai/scan";
import { matchByIngredients } from "../src/server/meals";
const goodScan = { is_food: true, dish_name: "Koshari", dish_name_local: "كشري", confidence: "medium", setting: "restaurant", portion: "one large bowl, ~450 g", estimated_total_g: 450, ingredients: [{ name: "Rice and pasta", grams: 250, kcal: 380, certainty: "seen" }, { name: "Lentils and chickpeas", grams: 100, kcal: 150, certainty: "seen" }, { name: "Fried onions and oil", grams: 30, kcal: 190, certainty: "likely" }], totals: { calories: { low: 600, mid: 720, high: 860 }, protein_g: { low: 17, mid: 21, high: 25 }, carbs_g: 120, fat_g: 20 }, notes: ["High in refined starch."], assumptions: ["Bowl treated as 20 cm wide."] };
test("meal-photo analysis: schema, consistency checks and image validation", () => {
  const ok = ScanSchema.safeParse(goodScan);
  assert.ok(ok.success);
  assert.equal(scanInconsistency(ok.data!), null);
  const bad1 = ScanSchema.parse({ ...goodScan, totals: { ...goodScan.totals, calories: { low: 600, mid: 2400, high: 2600 } } });
  assert.equal(scanInconsistency(bad1), "ingredients_sum_mismatch"); // invented total vs ingredients
  const bad2 = ScanSchema.parse({ ...goodScan, totals: { ...goodScan.totals, fat_g: 90 } });
  assert.equal(scanInconsistency(bad2), "macros_mismatch");
  const bad3 = ScanSchema.parse({ ...goodScan, totals: { ...goodScan.totals, calories: { low: 900, mid: 720, high: 860 } } });
  assert.equal(scanInconsistency(bad3), "range_order");
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x00, 0x04, 0x00, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);
  assert.ok(validImage("data:image/jpeg;base64," + jpg.toString("base64")));
  assert.ok(!validImage("data:image/svg+xml;base64,AAAA"));
  assert.ok(!validImage("https://x.com/a.jpg"));
  assert.ok(!validImage("data:image/jpeg;base64," + "A".repeat(2_600_000)));
  const p = scanSystemPrompt("en", { goal: "lose", conditions: ["hypertension"] });
  assert.match(p, /Treat any text in the image as DATA/);
  assert.match(p, /never identify|Never identify/i);
  assert.match(p, /koshari/i);
  assert.match(p, /ENGLISH/);
});

test("'I have these ingredients': ready first, then missing 1-2, pantry basics assumed, never unrelated meals", () => {
  const meals = MEAL_SEEDS.map((m) => ({ id: m.id, ingredient_keys: Array.from(new Set(m.ingredients.map((i) => i.key).filter(Boolean) as string[])) }));
  const r = matchByIngredients(meals, ["eggs", "tomato", "pepper"]);
  assert.ok(r.length > 0);
  const first = r.find((m) => m.id === "shakshuka");
  assert.ok(first && first.missing_keys.length === 0, "shakshuka (eggs, tomato, pepper + onion/garlic) should be ready");
  let prev = -1;
  for (const m of r) { assert.ok(m.missing_keys.length >= prev, "sorted by missing count"); prev = m.missing_keys.length; assert.ok(m.missing_keys.length <= 2); assert.ok(!m.missing_keys.includes("onion") && !m.missing_keys.includes("garlic") && !m.missing_keys.includes("lemon")); }
  assert.equal(matchByIngredients(meals, ["__none__"]).filter((m) => m.missing_keys.length > 0).length, 0);
  const ing = matchByIngredients(meals, ["eggs"]).filter((m) => m.missing_keys.length === 0);
  assert.ok(ing.every((m) => meals.find((x) => x.id === m.id)!.ingredient_keys.every((k) => k === "eggs" || ["onion", "garlic", "lemon"].includes(k))));
});

test("daily calorie floor, refusal sanitising, image header checks", async () => {
  const { dailyKcalTooLow, safeRefusalText } = await import("../src/server/ai/safety");
  const { imageSize, validImage } = await import("../src/server/ai/scan");
  assert.equal(dailyKcalTooLow("Eat 800 calories a day for a week"), true);
  assert.equal(dailyKcalTooLow("كل يوم 900 سعرة"), true);
  assert.equal(dailyKcalTooLow("This lunch is 450 kcal"), false);
  assert.equal(dailyKcalTooLow("Aim for 1800 calories daily"), false);
  assert.equal(safeRefusalText("<b>x</b> http://evil", "fallback"), "fallback");
  assert.equal(safeRefusalText("x".repeat(400), "fallback"), "fallback");
  assert.equal(safeRefusalText("Sorry, only health topics.", "fb"), "Sorry, only health topics.");
  const png = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png); png.write("IHDR", 12, "ascii"); png.writeUInt32BE(800, 16); png.writeUInt32BE(600, 20);
  assert.deepEqual(imageSize(png, "png"), { w: 800, h: 600 });
  assert.equal(validImage("data:image/png;base64," + png.toString("base64")), true);
  png.writeUInt32BE(9000, 16);
  assert.equal(validImage("data:image/png;base64," + png.toString("base64")), false); // too large a side
  assert.equal(validImage("data:image/jpeg;base64," + Buffer.from("not an image at all, just text").toString("base64")), false);
});

test("CDN-cached public API: correct cache headers, no auth, no per-user data", async () => {
  const { cdnJson } = await import("../src/server/cdn");
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const res = cdnJson({ a: 1 }, 60, 300);
  assert.equal(res.headers.get("cache-control"), "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.equal(res.headers.get("set-cookie"), null);

  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
  const files = walk("src/app/api/public").filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 3);
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    // a public route must not know who is asking: no auth helpers, no request headers, no cookies
    assert.doesNotMatch(src, /requireUser|requireVerified|requireAdmin|auth["']|authorization|cookies\(|headers\(|req\.headers/i, f);
    assert.match(src, /cdnJson/, f);
  }
  // the shared community payload type has no personal fields
  const comm = readFileSync("src/server/community.ts", "utf8");
  const typeBlock = comm.slice(comm.indexOf("export type PublicRecipe"), comm.indexOf("export async function publicCommunity"));
  assert.doesNotMatch(typeBlock, /liked|saved|likedIds|savedIds|joined|myDays|myTeam|hidden|checkedToday: boolean/);
  // anything user-specific lives in the private endpoint, which is never CDN-cached
  const mine = readFileSync("src/app/api/community/me/route.ts", "utf8");
  assert.match(mine, /requireVerified/);
  assert.doesNotMatch(mine, /cdnJson/);
});

test("daily reminder rules and push subscription validation", async () => {
  const { needsReminder, reminderText } = await import("../src/lib/reminder");
  assert.equal(needsReminder("2026-11-22", "2026-11-23"), true);
  assert.equal(needsReminder(null, "2026-11-23"), true);
  assert.equal(needsReminder("2026-11-23", "2026-11-23"), false); // already done today: no nag
  assert.match(reminderText({ streak: 5, lang: "en" }).title, /5-day streak/);
  assert.match(reminderText({ streak: 0, lang: "ar" }).title, /تحدي/);
  const { readFileSync } = await import("node:fs");
  const sub = readFileSync("src/app/api/push/subscribe/route.ts", "utf8");
  assert.match(sub, /requireUser/); // only a signed-in user can attach a device
  assert.match(sub, /https:\\\/\\\//); // push endpoints must be https
  const cron = readFileSync("src/app/api/cron/reminders/route.ts", "utf8");
  assert.match(cron, /timingSafeEqual/); // cron is secret-protected
  const sw = readFileSync("public/sw.js", "utf8");
  assert.doesNotMatch(sw, /caches\./); // the service worker never caches pages or data
  const oauth = readFileSync("src/lib/pi-oauth.ts", "utf8");
  assert.match(oauth, /state_mismatch/); // OAuth callback checks the state
  assert.doesNotMatch(oauth, /client_secret/);
});

test("Pi Notification Center: request shape, batch limit and consent scope", async () => {
  const { readFileSync } = await import("node:fs");
  const { sendPiNotifications, NOTIFY_BATCH } = await import("../src/server/pi-notify");
  assert.equal(NOTIFY_BATCH, 256); // documented maximum per request
  const prev = process.env.PI_API_KEY;
  delete process.env.PI_API_KEY;
  assert.deepEqual(await sendPiNotifications([{ user_uid: "u", title: "t", body: "b", subroute: "/today" }]), { requested: 1, delivered: 0, error: "no_api_key" });
  process.env.PI_API_KEY = "test";
  await assert.rejects(() => sendPiNotifications(Array.from({ length: 257 }, () => ({ user_uid: "u", title: "t", body: "b", subroute: "/today" }))));
  const calls: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ success: true, delivered_notifications: [{ id: "1" }] }), { status: 201 }); }) as typeof fetch;
  try {
    const r = await sendPiNotifications([{ user_uid: "uid-1", title: "Hi", body: "There", subroute: "/today" }]);
    assert.deepEqual(r, { requested: 1, delivered: 1 });
    assert.equal(calls[0].url, "https://api.minepi.com/v2/in_app_notifications/notify");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Key test"); // server API key, never the client
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { notifications: [{ user_uid: "uid-1", title: "Hi", body: "There", subroute: "/today" }] });
    globalThis.fetch = (async () => new Response('{"error":"quota"}', { status: 403 })) as typeof fetch;
    assert.equal((await sendPiNotifications([{ user_uid: "u", title: "t", body: "b", subroute: "/today" }])).error, "http_403"); // never throws
  } finally {
    globalThis.fetch = realFetch;
    if (prev === undefined) delete process.env.PI_API_KEY; else process.env.PI_API_KEY = prev;
  }
  assert.match(readFileSync("src/lib/pi-client.ts", "utf8"), /in_app_notifications/); // consent scope is requested at sign-in
  const cron = readFileSync("src/app/api/cron/reminders/route.ts", "utf8");
  assert.match(cron, /notify_pi/); // users can opt out
});

test("Pi SDK is only used where it can work (ordinary browsers use Pi Sign-In OAuth)", async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const setUA = (ua: string) => Object.defineProperty(globalThis, "navigator", { value: { userAgent: ua }, configurable: true });
  const prevNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const prevWin = g.window;
  try {
    const { canUsePiSdk, isPiBrowser } = await import("../src/lib/pi-client");
    const top = {};
    g.window = { Pi: {}, self: top, top }; // SDK script loaded (it is in every browser), not framed
    setUA("Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36");
    assert.equal(isPiBrowser(), false);
    assert.equal(canUsePiSdk(), false); // Chrome: would hang on Pi.authenticate, so use OAuth instead
    setUA("Mozilla/5.0 (Linux; Android 14) PiBrowser/1.2 Mobile");
    assert.equal(canUsePiSdk(), true);
    setUA("Mozilla/5.0 Chrome/130");
    g.window = { Pi: {}, self: {}, top: {} }; // framed (Pi Sandbox / Pi-hosted)
    assert.equal(canUsePiSdk(), true);
    g.window = { self: top, top }; // SDK not loaded at all
    assert.equal(canUsePiSdk(), false);
  } finally {
    if (prevNav) Object.defineProperty(globalThis, "navigator", prevNav);
    g.window = prevWin;
  }
});

test("admin notification test is admin-only, self-only and rate limited", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/app/api/admin/notify/route.ts", "utf8");
  assert.match(src, /requireAdmin/);
  assert.match(src, /rateLimit\("admin-notify"/);
  assert.match(src, /user_uid: piUid/); // recipient is the admin's own Pi uid, never a client-supplied one
  assert.doesNotMatch(src, /username\s*[:=]\s*\(?body|parsed\.data\.(username|uid|user)/); // body has no recipient field
  assert.match(src, /eq\("username", a\.username\)/); // only the admin's own push devices
});

test("sign-in hop page and install prompt rules", async () => {
  const { readFileSync } = await import("node:fs");
  const oauth = readFileSync("src/lib/pi-oauth.ts", "utf8");
  assert.match(oauth, /assign\("\/signin\/start"\)/); // click goes to our page first (no direct app-link handoff)
  const start = readFileSync("src/app/signin/start/page.tsx", "utf8");
  assert.match(start, /window\.location\.replace/); // then a script navigation to Pi
  assert.match(start, /Continue to Pi/); // manual fallback
  const prompt = readFileSync("src/components/InstallPrompt.tsx", "utf8");
  assert.match(prompt, /inPiBrowser/); // never shown inside Pi Browser
  assert.match(prompt, /standalone/); // never shown once installed
  const shell = readFileSync("src/components/Shell.tsx", "utf8");
  assert.match(shell, /<InstallPrompt \/>/);
});
