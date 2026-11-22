-- Pi Healthy schema. Every user row is keyed by the verified Pi username (never an email).
-- All access goes through server API routes using the service-role key. RLS is enabled on every
-- table with NO policies, so the anon / authenticated keys can read or write nothing directly.


-- ---------------------------------------------------------------- profiles
create table if not exists profiles (
  username text primary key,
  pi_uid text unique,
  kyc_verified boolean not null default false,
  age int check (age between 5 and 120),
  sex text check (sex in ('male','female')),
  weight_kg numeric(5,1) check (weight_kg between 20 and 400),
  height_cm numeric(5,1) check (height_cm between 80 and 250),
  goal text check (goal in ('lose','gain','maintain')),
  activity text check (activity in ('low','medium','high')),
  conditions text[] not null default '{}',
  disclaimer_accepted_at timestamptz,
  language text not null default 'ar' check (language in ('ar','en')),
  timezone text not null default 'Africa/Cairo',
  leaderboard_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- challenges
create table if not exists challenges (
  id text primary key,
  type text not null,
  title_ar text not null,
  title_en text not null,
  target_value numeric,
  unit text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists user_challenges (
  id uuid primary key default gen_random_uuid(),
  username text not null references profiles(username) on delete cascade,
  challenge_id text not null references challenges(id),
  date date not null,
  status text not null default 'assigned' check (status in ('assigned','swapped','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (username, date, challenge_id)
);
create index if not exists user_challenges_user_date on user_challenges (username, date);

create table if not exists streaks (
  username text primary key references profiles(username) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_completed_date date,
  total_completed int not null default 0
);

create table if not exists badges (
  username text not null references profiles(username) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  primary key (username, badge_key)
);

-- ---------------------------------------------------------------- meals
create table if not exists meals (
  id text primary key,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  name_ar text not null,
  name_en text not null,
  photo_url text,
  time_min int not null,
  calories int not null,
  protein_g int not null,
  cost_egp int not null,
  why_ar text not null,
  why_en text not null,
  tags text[] not null default '{}',
  ingredients jsonb not null,
  ingredient_keys text[] not null default '{}',
  steps jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists meals_type_active on meals (meal_type, active);

create table if not exists meal_overrides (
  date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  meal_id text not null references meals(id),
  primary key (date, meal_type)
);

create table if not exists favourites (
  username text not null references profiles(username) on delete cascade,
  source_type text not null check (source_type in ('meal','recipe')),
  source_id text not null,
  created_at timestamptz not null default now(),
  primary key (username, source_type, source_id)
);

-- ---------------------------------------------------------------- purchases / credits / plan
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  username text not null references profiles(username) on delete cascade,
  kind text not null check (kind in ('plan','pack')),
  item_key text not null,
  amount_pi numeric(12,4) not null,
  pi_payment_id text,
  txid text,
  status text not null default 'pending' check (status in ('pending','approved','completed','failed','cancelled')),
  fail_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
-- A Pi payment id can only ever be attached to one purchase.
create unique index if not exists purchases_payment_unique on purchases (pi_payment_id) where pi_payment_id is not null;
create index if not exists purchases_user on purchases (username, created_at desc);

create table if not exists credit_ledger (
  id bigserial primary key,
  username text not null references profiles(username) on delete cascade,
  change int not null check (change <> 0),
  balance_kind text not null check (balance_kind in ('plan','pack','trial')),
  reason text not null check (reason in ('trial_grant','purchase','plan_grant','generation','refund','expiry')),
  related_purchase_id uuid references purchases(id),
  related_request_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user on credit_ledger (username, balance_kind);
-- Trial grant exactly once per user.
create unique index if not exists credit_ledger_trial_once on credit_ledger (username) where reason = 'trial_grant';
-- Append-only: block updates and deletes.
create or replace function credit_ledger_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only';
end $$;
drop trigger if exists credit_ledger_no_update on credit_ledger;
create trigger credit_ledger_no_update before update or delete on credit_ledger
  for each row execute function credit_ledger_immutable();

create table if not exists subscriptions (
  username text primary key references profiles(username) on delete cascade,
  plan_key text not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  source_purchase_id uuid references purchases(id)
);

-- ---------------------------------------------------------------- AI
create table if not exists ai_requests (
  id uuid primary key default gen_random_uuid(),
  username text not null references profiles(username) on delete cascade,
  type text not null check (type in ('recipe','follow-up','plan')),
  input_summary text,
  output jsonb,
  credit_cost int not null default 0,
  status text not null default 'pending' check (status in ('pending','completed','failed','refunded')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ai_requests_user on ai_requests (username, created_at desc);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  username text not null references profiles(username) on delete cascade,
  title text not null,
  content jsonb not null,
  source_request_id uuid references ai_requests(id),
  like_count int not null default 0,
  save_count int not null default 0,
  shared boolean not null default false,
  shared_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists recipes_user on recipes (username, created_at desc);

create table if not exists recipe_messages (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  username text not null references profiles(username) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists recipe_messages_recipe on recipe_messages (recipe_id, created_at);

create table if not exists recipe_likes (
  recipe_id uuid not null references recipes(id) on delete cascade,
  username text not null references profiles(username) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, username)
);

-- ---------------------------------------------------------------- plan / progress
create table if not exists diet_plans (
  id uuid primary key default gen_random_uuid(),
  username text not null references profiles(username) on delete cascade,
  week_start date not null,
  daily_calorie_target int not null check (daily_calorie_target >= 1200),
  daily_water_target int not null,
  adjustment_kcal int not null default 0,
  plan jsonb not null,
  status text not null default 'active' check (status in ('active','replaced')),
  created_at timestamptz not null default now(),
  unique (username, week_start)
);

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  username text not null references profiles(username) on delete cascade,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 400),
  logged_date date not null,
  is_official boolean not null default false,
  week_start date not null,
  created_at timestamptz not null default now()
);
-- At most one official weekly entry per user per week.
create unique index if not exists weight_official_once on weight_logs (username, week_start) where is_official;
create index if not exists weight_user on weight_logs (username, logged_date);

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  username text not null references profiles(username) on delete cascade,
  date date not null,
  water_cups int check (water_cups between 0 and 40),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  steps int check (steps between 0 and 200000),
  unique (username, date)
);

create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  username text not null references profiles(username) on delete cascade,
  week_start date not null,
  summary jsonb not null,
  tip text not null,
  created_at timestamptz not null default now(),
  unique (username, week_start)
);

-- ---------------------------------------------------------------- community (reputation only, no Pi)
create table if not exists group_challenges (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  challenge_id text references challenges(id),
  title_ar text not null,
  title_en text not null,
  created_at timestamptz not null default now()
);
create table if not exists group_challenge_members (
  group_id uuid not null references group_challenges(id) on delete cascade,
  username text not null references profiles(username) on delete cascade,
  days_completed int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (group_id, username)
);
create table if not exists group_challenge_checks (
  group_id uuid not null,
  username text not null,
  date date not null,
  primary key (group_id, username, date),
  foreign key (group_id, username) references group_challenge_members(group_id, username) on delete cascade
);

-- ---------------------------------------------------------------- RLS: deny everything to anon/authenticated
do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','challenges','user_challenges','streaks','badges','meals','meal_overrides','favourites',
    'purchases','credit_ledger','subscriptions','ai_requests','recipes','recipe_messages','recipe_likes',
    'diet_plans','weight_logs','habit_logs','weekly_reports','group_challenges','group_challenge_members',
    'group_challenge_checks'])
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- credit functions (atomic)

-- Expire plan credits once the plan period has ended. Writes one 'expiry' ledger row.
create or replace function settle_plan_expiry(p_user text) returns void language plpgsql as $$
declare v_exp timestamptz; v_left int;
begin
  select expires_at into v_exp from subscriptions where username = p_user;
  if v_exp is not null and v_exp <= now() then
    select coalesce(sum(change), 0) into v_left from credit_ledger where username = p_user and balance_kind = 'plan';
    if v_left > 0 then
      insert into credit_ledger (username, change, balance_kind, reason) values (p_user, -v_left, 'plan', 'expiry');
    end if;
  end if;
end $$;

-- Balances derived purely from the ledger.
create or replace function credit_balances(p_user text)
returns table (plan int, pack int, trial int, plan_expires_at timestamptz) language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_user));
  perform settle_plan_expiry(p_user);
  return query
    select
      coalesce(sum(change) filter (where balance_kind = 'plan'), 0)::int,
      coalesce(sum(change) filter (where balance_kind = 'pack'), 0)::int,
      coalesce(sum(change) filter (where balance_kind = 'trial'), 0)::int,
      (select expires_at from subscriptions where username = p_user)
    from credit_ledger where username = p_user;
end $$;

-- Spend exactly one credit. Order: plan -> trial -> pack. Returns the kind spent, or null when empty.
create or replace function spend_credit(p_user text, p_request uuid) returns text language plpgsql as $$
declare v_plan int; v_pack int; v_trial int; v_kind text;
begin
  perform pg_advisory_xact_lock(hashtext(p_user));
  perform settle_plan_expiry(p_user);
  select
    coalesce(sum(change) filter (where balance_kind = 'plan'), 0),
    coalesce(sum(change) filter (where balance_kind = 'pack'), 0),
    coalesce(sum(change) filter (where balance_kind = 'trial'), 0)
  into v_plan, v_pack, v_trial from credit_ledger where username = p_user;

  if v_plan > 0 then v_kind := 'plan';
  elsif v_trial > 0 then v_kind := 'trial';
  elsif v_pack > 0 then v_kind := 'pack';
  else return null;
  end if;

  insert into credit_ledger (username, change, balance_kind, reason, related_request_id)
  values (p_user, -1, v_kind, 'generation', p_request);
  return v_kind;
end $$;

-- Refund the credit spent by a request (idempotent).
create or replace function refund_request(p_request uuid) returns boolean language plpgsql as $$
declare v_user text; v_kind text;
begin
  select username, balance_kind into v_user, v_kind from credit_ledger
    where related_request_id = p_request and reason = 'generation' limit 1;
  if v_user is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext(v_user));
  if exists (select 1 from credit_ledger where related_request_id = p_request and reason = 'refund') then
    return false;
  end if;
  insert into credit_ledger (username, change, balance_kind, reason, related_request_id)
  values (v_user, 1, v_kind, 'refund', p_request);
  perform settle_plan_expiry(v_user);
  return true;
end $$;

create or replace function grant_trial(p_user text, p_credits int) returns boolean language plpgsql as $$
declare v_n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user));
  insert into credit_ledger (username, change, balance_kind, reason)
  values (p_user, p_credits, 'trial', 'trial_grant')
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- Mark a purchase completed and grant the service, all in one transaction. Idempotent.
create or replace function complete_purchase(p_purchase uuid, p_txid text, p_credits int, p_days int)
returns text language plpgsql as $$
declare pr purchases%rowtype; v_start timestamptz;
begin
  select * into pr from purchases where id = p_purchase for update;
  if not found then raise exception 'purchase not found'; end if;
  if pr.status = 'completed' then return 'already_completed'; end if;
  if pr.status not in ('pending','approved') then raise exception 'purchase is %', pr.status; end if;
  perform pg_advisory_xact_lock(hashtext(pr.username));

  update purchases set status = 'completed', txid = p_txid, completed_at = now() where id = p_purchase;

  if pr.kind = 'pack' then
    insert into credit_ledger (username, change, balance_kind, reason, related_purchase_id)
    values (pr.username, p_credits, 'pack', 'purchase', p_purchase);
  else
    perform settle_plan_expiry(pr.username);
    select greatest(now(), coalesce((select expires_at from subscriptions where username = pr.username), now()))
      into v_start;
    insert into subscriptions (username, plan_key, started_at, expires_at, source_purchase_id)
    values (pr.username, pr.item_key, now(), v_start + make_interval(days => p_days), p_purchase)
    on conflict (username) do update
      set plan_key = excluded.plan_key, expires_at = excluded.expires_at, source_purchase_id = excluded.source_purchase_id;
    insert into credit_ledger (username, change, balance_kind, reason, related_purchase_id)
    values (pr.username, p_credits, 'plan', 'plan_grant', p_purchase);
  end if;
  return 'completed';
end $$;

revoke all on function settle_plan_expiry(text), credit_balances(text), spend_credit(text, uuid),
  refund_request(uuid), grant_trial(text, int), complete_purchase(uuid, text, int, int)
  from public, anon, authenticated;
