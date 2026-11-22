import { Landing } from "@/components/Landing";
import { PRICING, TRIAL_CREDITS } from "@/config/pricing";
import { quoteAll } from "@/server/pi-price";
import { MEAL_SEEDS } from "@/data/meals";
import { CHALLENGE_SEEDS } from "@/data/challenges";
import { MEALS_EN } from "@/data/meals-en";

export const revalidate = 60;

export default async function Home() {
  const quotes = await quoteAll();
  const items = quotes.map((q) => ({ key: q.key, kind: PRICING[q.key].kind, pricePi: q.pricePi, usd: q.usd, credits: PRICING[q.key].credits, days: PRICING[q.key].days }));
  return <Landing items={items} trial={TRIAL_CREDITS} meal={MEAL_SEEDS.find((m) => m.id === "foul-balady")!} challenge={CHALLENGE_SEEDS[0]} ingredientsEn={MEALS_EN["foul-balady"]?.ingredients} />;
}
