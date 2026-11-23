-- Growth features: food diary, streak freeze, per-user reminder hour, plan-expiry notice, friend (duo) challenges.

-- ---------------------------------------------------------------- food diary
create table if not exists hl_food_log (
  id uuid primary key default gen_random_uuid(),
  username text not null references hl_profiles(username) on delete cascade,
  date date not null,
  name text not null check (char_length(name) between 1 and 120),
  calories int not null check (calories between 0 and 5000),
  protein_g numeric(6,1) not null default 0 check (protein_g between 0 and 500),
  source text not null check (source in ('meal', 'scan', 'manual')),
  source_id text,
  created_at timestamptz not null default now()
);
create index if not exists hl_food_user_date on hl_food_log (username, date);
alter table hl_food_log enable row level security;
revoke all on hl_food_log from anon, authenticated;

-- ---------------------------------------------------------------- streak freeze (one protected missed day per 7 days)
alter table hl_streaks add column if not exists freeze_used_on date;

-- ---------------------------------------------------------------- reminders at the user's own hour
alter table hl_profiles add column if not exists reminder_hour smallint not null default 17 check (reminder_hour between 0 and 23);
alter table hl_profiles add column if not exists last_reminded_on date;
alter table hl_subscriptions add column if not exists expiry_notified_for timestamptz;

-- Local "now" for a timezone name; falls back to Cairo for names Postgres does not know.
create or replace function hl_local_now(tz text) returns timestamp language plpgsql stable set search_path = public as $$
begin
  return now() at time zone coalesce(nullif(tz, ''), 'Africa/Cairo');
exception when others then
  return now() at time zone 'Africa/Cairo';
end $$;

-- Atomically claim people whose reminder hour is NOW (their local time) and who have not done a challenge today.
-- Claiming marks last_reminded_on, so overlapping or repeated runs can never send twice for the same local day.
create or replace function hl_claim_reminders(p_limit int)
returns table (username text, pi_uid text, language text, timezone text, current_streak int, last_completed_date date, local_date date, notify_pi boolean)
language plpgsql set search_path = public as $$
begin
  return query
  with due as (
    select p.username as u, hl_local_now(p.timezone)::date as ld
    from hl_profiles p
    left join hl_streaks s on s.username = p.username
    where p.deleted_at is null
      and p.updated_at >= now() - interval '30 days'
      and extract(hour from hl_local_now(p.timezone)) = p.reminder_hour
      and p.last_reminded_on is distinct from hl_local_now(p.timezone)::date
      and s.last_completed_date is distinct from hl_local_now(p.timezone)::date
    order by p.username
    limit p_limit
    for update of p skip locked
  ), marked as (
    update hl_profiles p set last_reminded_on = due.ld from due where p.username = due.u
    returning p.username as mu
  )
  select p.username, p.pi_uid, p.language, p.timezone, coalesce(s.current_streak, 0), s.last_completed_date, d.ld, p.notify_pi
  from marked m
  join due d on d.u = m.mu
  join hl_profiles p on p.username = m.mu
  left join hl_streaks s on s.username = p.username;
end $$;

-- Plans that end within 3 days: notify once per expiry date, at the user's reminder hour.
create or replace function hl_claim_expiry_notices(p_limit int)
returns table (username text, pi_uid text, language text, expires_at timestamptz, notify_pi boolean)
language plpgsql set search_path = public as $$
begin
  return query
  with due as (
    select sub.username as u, sub.expires_at as ex
    from hl_subscriptions sub
    join hl_profiles p on p.username = sub.username
    where p.deleted_at is null
      and sub.expires_at > now() and sub.expires_at <= now() + interval '3 days'
      and sub.expiry_notified_for is distinct from sub.expires_at
      and extract(hour from hl_local_now(p.timezone)) = p.reminder_hour
    order by sub.username
    limit p_limit
    for update of sub skip locked
  ), marked as (
    update hl_subscriptions s set expiry_notified_for = due.ex from due where s.username = due.u
    returning s.username as mu
  )
  select p.username, p.pi_uid, p.language, d.ex, p.notify_pi
  from marked m join due d on d.u = m.mu join hl_profiles p on p.username = m.mu;
end $$;

-- ---------------------------------------------------------------- friend (duo) challenge
create table if not exists hl_duos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 6 and 24),
  inviter text not null references hl_profiles(username) on delete cascade,
  invitee text references hl_profiles(username) on delete cascade,
  start_date date not null,
  created_at timestamptz not null default now(),
  check (invitee is null or invitee <> inviter)
);
create index if not exists hl_duos_inviter on hl_duos (inviter);
create index if not exists hl_duos_invitee on hl_duos (invitee);
alter table hl_duos enable row level security;
revoke all on hl_duos from anon, authenticated;

revoke all on function hl_local_now(text), hl_claim_reminders(int), hl_claim_expiry_notices(int) from public, anon, authenticated;
