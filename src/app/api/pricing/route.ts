import { ok, route } from "@/server/http";
import { PRICING, TRIAL_CREDITS } from "@/config/pricing";

export const GET = route(async () => ok({ items: Object.values(PRICING), trialCredits: TRIAL_CREDITS, network: process.env.NEXT_PUBLIC_PI_NETWORK ?? "testnet" }));
