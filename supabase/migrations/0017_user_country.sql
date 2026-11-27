-- Country of each Pioneer (two-letter ISO code taken from the hosting edge header). The IP address itself is never stored.
alter table hl_profiles add column if not exists country text;

create or replace function hl_touch_login(p_user text, p_day date, p_country text default null) returns void
language sql set search_path = public as $$
  update hl_profiles set last_login_at = now(), login_count = login_count + 1, country = coalesce(p_country, country) where username = p_user;
  insert into hl_user_days (username, day) values (p_user, p_day) on conflict do nothing;
$$;
revoke all on function hl_touch_login(text, date, text) from public, anon, authenticated;
grant execute on function hl_touch_login(text, date, text) to service_role;
drop function if exists hl_touch_login(text, date);

-- Owner report: country per user plus a ranking of countries (users, active in 30 days, Pi paid).
create or replace function hl_admin_report(p_today date)
returns jsonb language sql set search_path = public as $fn$
with ud as (select username, count(*) as active_days, min(day) as first_day, max(day) as last_day from hl_user_days group by username),
ai as (select username, count(*) as ai_requests from hl_ai_requests where status = 'completed' group by username),
fl as (select username, count(*) as food_entries from hl_food_log group by username),
ch as (select username, count(*) as challenges_done from hl_user_challenges where status = 'completed' group by username),
pu as (select username, sum(amount_pi) as pi_paid, count(*) as purchases, max(created_at) as last_purchase from hl_purchases where status = 'completed' group by username),
cr as (select username, sum(change) as credits_left from hl_credit_ledger group by username),
sb as (select username from hl_subscriptions where expires_at > now()),
per as (
  select p.username, p.created_at, p.last_login_at, p.login_count, p.kyc_verified, p.language, p.country, (p.deleted_at is not null) as deleted,
    coalesce(ud.active_days, 0) as active_days, ud.first_day, ud.last_day,
    coalesce(ai.ai_requests, 0) as ai_requests, coalesce(fl.food_entries, 0) as food_entries, coalesce(ch.challenges_done, 0) as challenges_done,
    coalesce(pu.pi_paid, 0) as pi_paid, coalesce(pu.purchases, 0) as purchases, pu.last_purchase,
    coalesce(cr.credits_left, 0) as credits_left, (sb.username is not null) as plan_active
  from hl_profiles p
  left join ud on ud.username = p.username left join ai on ai.username = p.username left join fl on fl.username = p.username
  left join ch on ch.username = p.username left join pu on pu.username = p.username left join cr on cr.username = p.username left join sb on sb.username = p.username
)
select jsonb_build_object(
  'users', coalesce((select jsonb_agg(to_jsonb(x) order by coalesce(x.last_login_at, x.created_at) desc) from (select * from per order by coalesce(last_login_at, created_at) desc limit 2000) x), '[]'::jsonb),
  'daily', coalesce((select jsonb_agg(jsonb_build_object('day', g.day::date,
      'active', (select count(*) from hl_user_days u where u.day = g.day::date),
      'new', (select count(*) from hl_profiles p where (p.created_at at time zone 'Africa/Cairo')::date = g.day::date)) order by g.day)
    from generate_series(p_today - 29, p_today, interval '1 day') g(day)), '[]'::jsonb),
  'countries', coalesce((select jsonb_agg(c order by c.users desc, c.code) from (
      select coalesce(country, '??') as code, count(*) as users,
        count(*) filter (where last_day > p_today - 30) as active30,
        count(*) filter (where purchases > 0) as paying,
        coalesce(sum(pi_paid), 0) as pi,
        coalesce(sum(ai_requests), 0) as ai
      from per where deleted = false group by 1) c), '[]'::jsonb),
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
    'd7_returned', (select count(*) from per where first_day is not null and first_day <= p_today - 7 and exists (select 1 from hl_user_days u where u.username = per.username and u.day between per.first_day + 1 and per.first_day + 7)),
    'paying_users', (select count(*) from per where purchases > 0),
    'pi_total', (select coalesce(sum(pi_paid), 0) from per),
    'purchases_total', (select coalesce(sum(purchases), 0) from per),
    'credits_outstanding', (select coalesce(sum(greatest(credits_left, 0)), 0) from per),
    'ai_total', (select coalesce(sum(ai_requests), 0) from per)
  )
);
$fn$;
revoke all on function hl_admin_report(date) from public, anon, authenticated;
grant execute on function hl_admin_report(date) to service_role;
