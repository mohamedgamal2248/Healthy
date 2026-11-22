import { Landing } from "@/components/Landing";
import { PRICING, TRIAL_CREDITS } from "@/config/pricing";
import { MEAL_SEEDS } from "@/data/meals";
import { CHALLENGE_SEEDS } from "@/data/challenges";

export default function Home() {
  return <Landing items={Object.values(PRICING)} trial={TRIAL_CREDITS} meal={MEAL_SEEDS.find((m) => m.id === "foul-balady")!} challenge={CHALLENGE_SEEDS[0]} />;
}
