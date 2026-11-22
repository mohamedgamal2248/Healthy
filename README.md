# صحتي | Pi Healthy

Daily healthy challenges, cheap Egyptian meals, an AI Chef and personal diet plans for KYC-verified Pi Pioneers.
Next.js (App Router) + TypeScript + Tailwind v4 + Supabase. Arabic-first (RTL) with an English toggle. Pi Testnet first.

## Payment model (hard rule)
Service-only, user-to-app (U2A) only. The Pioneer pays the app wallet, the server verifies the payment with the Pi API
(amount = config price, payer = purchase owner, memo = `healthy_plan:<id>` / `healthy_pack:<id>`, completed, unique payment id)
and only then grants credits or 30 days of plan access. No escrow, no A2U, no transfers between users, no auto-renewal.
Prices live in `src/config/pricing.ts`.

## Setup
1. `cp .env.example .env.local` and fill it in (see comments there).
2. Run `supabase/migrations/0001_init.sql` in your Supabase project (SQL editor or CLI).
3. `npm install && npm run seed` (30 meals + 16 challenges).
4. `npm run dev`. Pi sign-in only works inside Pi Browser / Pi Sandbox (`NEXT_PUBLIC_PI_SANDBOX=true` for localhost).
   For local UI work only, `ALLOW_DEV_LOGIN=true` enables a dev login that is disabled in production builds.
5. Deploy to Vercel and set the same env vars. Add your Vercel / PiNet URL in Pi Developers.

## Tests
`npm test` (SQL credit-ledger tests run on PGlite; pure-logic tests for streaks, plans, payment verification, AI safety).

## Notes
- KYC: Pi's `/me` does not always expose KYC. `PI_KYC_MODE=strict` requires an explicit flag; default on testnet treats Pi-authenticated users as verified so end-to-end tests are possible. Use `strict` before any Mainnet work.
- AI: default provider is the Meta Model API with `muse-ember-1.0` (`AI_PROVIDER=meta`); set `AI_API_KEY`. `anthropic` / `openai` are also supported. Without them the AI features show "not configured".
