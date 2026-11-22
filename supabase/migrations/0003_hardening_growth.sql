-- 1. Fixed search_path on all hl_ functions (Supabase security advisor)
alter function hl_settle_plan_expiry(text) set search_path = public;
alter function hl_credit_balances(text) set search_path = public;
alter function hl_spend_credit(text, uuid) set search_path = public;
alter function hl_refund_request(uuid) set search_path = public;
alter function hl_grant_trial(text, int) set search_path = public;
alter function hl_complete_purchase(uuid, text, int, int) set search_path = public;
alter function hl_credit_ledger_immutable() set search_path = public;

-- 2. Covering indexes for foreign keys + hot paths
create index if not exists hl_ledger_purchase on hl_credit_ledger (related_purchase_id) where related_purchase_id is not null;
create index if not exists hl_gcm_username on hl_group_challenge_members (username);
create index if not exists hl_gc_challenge on hl_group_challenges (challenge_id);
create index if not exists hl_overrides_meal on hl_meal_overrides (meal_id);
create index if not exists hl_likes_user on hl_recipe_likes (username);
create index if not exists hl_msgs_user on hl_recipe_messages (username);
create index if not exists hl_recipes_request on hl_recipes (source_request_id);
create index if not exists hl_subs_purchase on hl_subscriptions (source_purchase_id);
create index if not exists hl_uc_challenge on hl_user_challenges (challenge_id);
create index if not exists hl_checks_date on hl_group_challenge_checks (date);
create index if not exists hl_recipes_shared on hl_recipes (shared_at desc) where shared;

-- 3. Profile: session revocation, account deletion marker, referral link
alter table hl_profiles add column if not exists token_version int not null default 0;
alter table hl_profiles add column if not exists deleted_at timestamptz;

-- 4. Real AI cost per request
alter table hl_ai_requests add column if not exists tokens_in int;
alter table hl_ai_requests add column if not exists tokens_out int;
alter table hl_ai_requests add column if not exists searches int;
alter table hl_ai_requests add column if not exists est_cost_usd numeric(10,5);

-- 5. Admin audit log
create table if not exists hl_admin_audit (
  id bigserial primary key,
  admin text not null,
  action text not null,
  target text,
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table hl_admin_audit enable row level security;

-- 6. Generic fixed-window rate limiter (atomic upsert)
create table if not exists hl_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null default 0
);
alter table hl_rate_limits enable row level security;
create or replace function hl_rate_hit(p_key text, p_window int, p_max int) returns boolean
language plpgsql set search_path = public as $$
declare v_hits int;
begin
  insert into hl_rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window) then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_window) then 1 else r.hits + 1 end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- 7. Referrals (reputation + 1 AI request each, once per invited user, capped per referrer)
create table if not exists hl_referrals (
  invited text primary key references hl_profiles(username) on delete cascade,
  referrer text not null references hl_profiles(username) on delete cascade,
  rewarded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists hl_referrals_referrer on hl_referrals (referrer);
alter table hl_referrals enable row level security;

create or replace function hl_reward_referral(p_invited text, p_credits int, p_cap int) returns text
language plpgsql set search_path = public as $$
declare v_ref text; v_done int;
begin
  select referrer into v_ref from hl_referrals where invited = p_invited and rewarded = false for update;
  if v_ref is null then return null; end if;
  select count(*) into v_done from hl_referrals where referrer = v_ref and rewarded = true;
  update hl_referrals set rewarded = true where invited = p_invited;
  if v_done >= p_cap then return null; end if;
  insert into hl_credit_ledger (username, change, balance_kind, reason) values (v_ref, p_credits, 'trial', 'referral'), (p_invited, p_credits, 'trial', 'referral');
  return v_ref;
end $$;

revoke all on function hl_rate_hit(text,int,int), hl_reward_referral(text,int,int) from public, anon, authenticated;
alter table hl_credit_ledger drop constraint hl_credit_ledger_reason_check;
alter table hl_credit_ledger add constraint hl_credit_ledger_reason_check check (reason in ('trial_grant','purchase','plan_grant','generation','refund','expiry','referral'));
