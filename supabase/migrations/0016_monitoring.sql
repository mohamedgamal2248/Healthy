-- Site monitoring for the owner dashboard: per-route request counters (hourly), a de-duplicated error list, and report functions.
-- Written in batches (at most one write per server instance every 15 s), kept 14 days, readable only by the service role.

create table if not exists hl_api_stats (
  hour timestamptz not null,
  route text not null,
  n int not null default 0,
  ms_sum bigint not null default 0,
  ms_max int not null default 0,
  e5xx int not null default 0,
  e4xx int not null default 0,
  slow int not null default 0,
  primary key (hour, route)
);
create table if not exists hl_api_errors (
  key text primary key,
  route text not null,
  status int not null,
  message text not null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  n int not null default 1
);
create index if not exists hl_api_errors_last on hl_api_errors (last_at desc);
alter table hl_api_stats enable row level security;
alter table hl_api_errors enable row level security;
revoke all on hl_api_stats, hl_api_errors from anon, authenticated;

-- p_rows: [{route,n,ms_sum,ms_max,e5,e4,slow}], p_errors: [{route,status,message,n}]
create or replace function hl_stat_flush(p_rows jsonb, p_errors jsonb) returns void
language plpgsql set search_path = public as $$
declare h timestamptz := date_trunc('hour', now());
begin
  insert into hl_api_stats (hour, route, n, ms_sum, ms_max, e5xx, e4xx, slow)
  select h, r->>'route', (r->>'n')::int, (r->>'ms_sum')::bigint, (r->>'ms_max')::int, (r->>'e5')::int, (r->>'e4')::int, (r->>'slow')::int
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (hour, route) do update set
    n = hl_api_stats.n + excluded.n, ms_sum = hl_api_stats.ms_sum + excluded.ms_sum, ms_max = greatest(hl_api_stats.ms_max, excluded.ms_max),
    e5xx = hl_api_stats.e5xx + excluded.e5xx, e4xx = hl_api_stats.e4xx + excluded.e4xx, slow = hl_api_stats.slow + excluded.slow;
  insert into hl_api_errors (key, route, status, message, n)
  select left(e->>'route' || '|' || (e->>'status') || '|' || left(e->>'message', 80), 200), e->>'route', (e->>'status')::int, left(e->>'message', 300), (e->>'n')::int
  from jsonb_array_elements(coalesce(p_errors, '[]'::jsonb)) e
  on conflict (key) do update set n = hl_api_errors.n + excluded.n, last_at = now(), message = excluded.message;
end $$;
revoke all on function hl_stat_flush(jsonb, jsonb) from public, anon, authenticated;
grant execute on function hl_stat_flush(jsonb, jsonb) to service_role;

-- Users report: aggregates (no per-user subqueries), now with Pi paid and credits left.
create or replace function hl_admin_report(p_today date) returns jsonb
language sql set search_path = public as $$
with ud as (select username, count(*) as active_days, min(day) as first_day, max(day) as last_day from hl_user_days group by username),
ai as (select username, count(*) as ai_requests from hl_ai_requests where status = 'completed' group by username),
fl as (select username, count(*) as food_entries from hl_food_log group by username),
ch as (select username, count(*) as challenges_done from hl_user_challenges where status = 'completed' group by username),
pu as (select username, sum(amount_pi) as pi_paid, count(*) as purchases, max(created_at) as last_purchase from hl_purchases where status = 'completed' group by username),
cr as (select username, sum(change) as credits_left from hl_credit_ledger group by username),
sb as (select username from hl_subscriptions where expires_at > now()),
per as (
  select p.username, p.created_at, p.last_login_at, p.login_count, p.kyc_verified, p.language, (p.deleted_at is not null) as deleted,
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
$$;
revoke all on function hl_admin_report(date) from public, anon, authenticated;
grant execute on function hl_admin_report(date) to service_role;

-- Site monitor: last 24 h by route and by hour, recent errors, AI outcomes, Pi revenue per day, database health.
create or replace function hl_admin_monitor() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'routes', coalesce((select jsonb_agg(x order by x.e5xx desc, x.n desc) from (
        select route, sum(n)::int as n, round(sum(ms_sum)::numeric / nullif(sum(n), 0))::int as avg_ms, max(ms_max) as max_ms, sum(e5xx)::int as e5xx, sum(e4xx)::int as e4xx, sum(slow)::int as slow
        from hl_api_stats where hour > now() - interval '24 hours' group by route order by sum(e5xx) desc, sum(n) desc limit 40) x), '[]'::jsonb),
    'hourly', coalesce((select jsonb_agg(x order by x.hour) from (
        select hour, sum(n)::int as n, sum(e5xx)::int as e5xx, sum(e4xx)::int as e4xx, sum(slow)::int as slow, round(sum(ms_sum)::numeric / nullif(sum(n), 0))::int as avg_ms
        from hl_api_stats where hour > now() - interval '24 hours' group by hour) x), '[]'::jsonb),
    'errors', coalesce((select jsonb_agg(to_jsonb(e) order by e.last_at desc) from (select route, status, message, n, first_at, last_at from hl_api_errors order by last_at desc limit 30) e), '[]'::jsonb),
    'ai24', jsonb_build_object(
      'completed', (select count(*) from hl_ai_requests where created_at > now() - interval '24 hours' and status = 'completed'),
      'refunded', (select count(*) from hl_ai_requests where created_at > now() - interval '24 hours' and status = 'refunded'),
      'failed', (select count(*) from hl_ai_requests where created_at > now() - interval '24 hours' and status = 'failed'),
      'pending_stuck', (select count(*) from hl_ai_requests where status = 'pending' and created_at < now() - interval '5 minutes'),
      'reasons', coalesce((select jsonb_agg(jsonb_build_object('error', coalesce(error, '-'), 'n', n) order by n desc) from (
          select error, count(*) as n from hl_ai_requests where created_at > now() - interval '24 hours' and status in ('refunded', 'failed') group by error order by count(*) desc limit 8) q), '[]'::jsonb)),
    'ai_daily', coalesce((select jsonb_agg(x order by x.day) from (
        select created_at::date as day, count(*) filter (where status = 'completed') as completed, count(*) filter (where status = 'refunded') as refunded, count(*) filter (where status = 'failed') as failed
        from hl_ai_requests where created_at > now() - interval '14 days' group by created_at::date) x), '[]'::jsonb),
    'money_daily', coalesce((select jsonb_agg(x order by x.day) from (
        select created_at::date as day, count(*)::int as purchases, coalesce(sum(amount_pi), 0) as pi from hl_purchases where status = 'completed' and created_at > now() - interval '14 days' group by created_at::date) x), '[]'::jsonb),
    'purchases_open', (select count(*) from hl_purchases where status = 'pending' and created_at > now() - interval '1 day'),
    'db', jsonb_build_object(
      'total_bytes', pg_database_size(current_database()),
      'healthy_bytes', (select coalesce(sum(pg_total_relation_size(c.oid)), 0) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'hl\_%'),
      'connections', (select count(*) from pg_stat_activity where datname = current_database()),
      'active_connections', (select count(*) from pg_stat_activity where datname = current_database() and state = 'active'),
      'top_tables', coalesce((select jsonb_agg(t) from (
          select c.relname as name, pg_total_relation_size(c.oid) as bytes, c.reltuples::bigint as rows
          from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'hl\_%'
          order by pg_total_relation_size(c.oid) desc limit 8) t), '[]'::jsonb))
  ) into r;
  return r;
end $$;
revoke all on function hl_admin_monitor() from public, anon, authenticated;
grant execute on function hl_admin_monitor() to service_role;
