-- Usage statistics for the owner dashboard: when each Pioneer registered, last signed in, and on which days they opened the app.
-- Only dates and counters are stored (no health data), and nothing here is readable by anon / authenticated roles.

alter table hl_profiles
  add column if not exists last_login_at timestamptz,
  add column if not exists login_count int not null default 0;

-- One row per user per local day on which the app was opened (Today view or Pi sign-in).
create table if not exists hl_user_days (
  username text not null references hl_profiles(username) on delete cascade,
  day date not null,
  first_seen timestamptz not null default now(),
  primary key (username, day)
);
create index if not exists hl_user_days_day on hl_user_days (day);
alter table hl_user_days enable row level security;
revoke all on hl_user_days from anon, authenticated;

-- Backfill from what the app already stored: a day on which Today assigned challenges, or food / habits were logged, is a day the app was opened.
insert into hl_user_days (username, day)
  select username, date from hl_user_challenges
  union select username, date from hl_food_log
  union select username, date from hl_habit_logs
on conflict do nothing;
update hl_profiles p set
  last_login_at = coalesce(last_login_at, greatest(p.updated_at, (select max(day)::timestamptz from hl_user_days u where u.username = p.username))),
  login_count = greatest(login_count, 1)
where last_login_at is null;

-- Called at every Pi sign-in.
create or replace function hl_touch_login(p_user text, p_day date) returns void
language sql set search_path = public as $$
  update hl_profiles set last_login_at = now(), login_count = login_count + 1 where username = p_user;
  insert into hl_user_days (username, day) values (p_user, p_day) on conflict do nothing;
$$;
revoke all on function hl_touch_login(text, date) from public, anon, authenticated;
grant execute on function hl_touch_login(text, date) to service_role;

-- The Today bundle also records "opened today" (one cheap no-op after the first view of the day).
create or replace function hl_today_bundle(p_user text, p_today date, p_week date, p_kyc boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_group uuid;
  v_bal jsonb := null;
begin
  insert into hl_user_days (username, day) values (p_user, p_today) on conflict do nothing;
  if p_kyc then
    select to_jsonb(b) into v_bal from hl_credit_balances(p_user) b limit 1;
  end if;
  select id into v_group from hl_group_challenges where week_start = p_week limit 1;
  return jsonb_build_object(
    'streak', (select to_jsonb(s) from (select current_streak, longest_streak, last_completed_date, total_completed, freeze_used_on from hl_streaks where username = p_user) s),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('badge_key', badge_key, 'earned_at', earned_at)) from hl_badges where username = p_user), '[]'::jsonb),
    'favs', coalesce((select jsonb_agg(source_id) from hl_favourites where username = p_user and source_type = 'meal'), '[]'::jsonb),
    'last_habit', (select max(date) from hl_habit_logs where username = p_user),
    'trial', exists (select 1 from hl_credit_ledger where username = p_user and reason = 'trial_grant'),
    'coach', exists (select 1 from hl_recipes where username = p_user and hidden = false),
    'done', coalesce((select jsonb_agg(distinct date) from hl_user_challenges where username = p_user and status = 'completed' and date between p_today - 6 and p_today), '[]'::jsonb),
    'food', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc) from (
        select id, name, calories, protein_g, carbs_g, fat_g, source, source_id, created_at, date
        from hl_food_log where username = p_user and date between p_today - 14 and p_today
        order by created_at desc limit 600) f), '[]'::jsonb),
    'plan_target', (select daily_calorie_target from hl_diet_plans where username = p_user and week_start = p_week limit 1),
    'group_days', case when v_group is null or not p_kyc then null else (select days_completed from hl_group_challenge_members where group_id = v_group and username = p_user) end,
    'group_joined', case when v_group is null or not p_kyc then false else exists (select 1 from hl_group_challenge_members where group_id = v_group and username = p_user) end,
    'balances', v_bal
  );
end $$;
revoke all on function hl_today_bundle(text, date, date, boolean) from public, anon, authenticated;
grant execute on function hl_today_bundle(text, date, date, boolean) to service_role;

-- Owner report: one row per user plus a 30-day series and summary numbers. No health fields.
create or replace function hl_admin_report(p_today date) returns jsonb
language sql set search_path = public as $$
with per as (
  select p.username, p.created_at, p.last_login_at, p.login_count, p.kyc_verified, p.language, (p.deleted_at is not null) as deleted,
    (select count(*) from hl_user_days u where u.username = p.username) as active_days,
    (select min(day) from hl_user_days u where u.username = p.username) as first_day,
    (select max(day) from hl_user_days u where u.username = p.username) as last_day,
    (select count(*) from hl_ai_requests r where r.username = p.username and r.status = 'completed') as ai_requests,
    (select count(*) from hl_food_log f where f.username = p.username) as food_entries,
    (select count(*) from hl_user_challenges c where c.username = p.username and c.status = 'completed') as challenges_done,
    exists (select 1 from hl_subscriptions s where s.username = p.username and s.expires_at > now()) as plan_active
  from hl_profiles p
)
select jsonb_build_object(
  'users', coalesce((select jsonb_agg(to_jsonb(per) order by coalesce(per.last_login_at, per.created_at) desc) from (select * from per limit 2000) per), '[]'::jsonb),
  'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'day', g.day::date,
      'active', (select count(*) from hl_user_days u where u.day = g.day::date),
      'new', (select count(*) from hl_profiles p where (p.created_at at time zone 'Africa/Cairo')::date = g.day::date)
    ) order by g.day) from generate_series(p_today - 29, p_today, interval '1 day') g(day)), '[]'::jsonb),
  'summary', jsonb_build_object(
    'total', (select count(*) from per),
    'dau', (select count(distinct username) from hl_user_days where day = p_today),
    'wau', (select count(distinct username) from hl_user_days where day > p_today - 7),
    'mau', (select count(distinct username) from hl_user_days where day > p_today - 30),
    'returned', (select count(*) from per where active_days >= 2),
    'never_returned', (select count(*) from per where active_days <= 1),
    'avg_active_days', (select coalesce(round(avg(active_days)::numeric, 1), 0) from per),
    'avg_logins', (select coalesce(round(avg(login_count)::numeric, 1), 0) from per),
    'd1_eligible', (select count(*) from per where first_day is not null and first_day <= p_today - 1),
    'd1_returned', (select count(*) from per where first_day is not null and first_day <= p_today - 1 and exists (select 1 from hl_user_days u where u.username = per.username and u.day = per.first_day + 1)),
    'd7_eligible', (select count(*) from per where first_day is not null and first_day <= p_today - 7),
    'd7_returned', (select count(*) from per where first_day is not null and first_day <= p_today - 7 and exists (select 1 from hl_user_days u where u.username = per.username and u.day between per.first_day + 1 and per.first_day + 7))
  )
);
$$;
revoke all on function hl_admin_report(date) from public, anon, authenticated;
grant execute on function hl_admin_report(date) to service_role;
