-- Notification system v2: scheduling, per-type opt-out, open measurement, finer audiences, event notices.

alter table hl_profiles
  add column if not exists notify_news boolean not null default true,
  add column if not exists notify_events boolean not null default true,
  add column if not exists last_seen_at timestamptz;

-- One row per notification sent (kind: reminder | expiry | broadcast | once:<event>). opened_at = the person opened the app within 24 h after.
create table if not exists hl_notif_log (
  id bigserial primary key,
  username text not null references hl_profiles(username) on delete cascade,
  kind text not null,
  ref uuid,
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);
create unique index if not exists hl_notif_log_ref on hl_notif_log (ref, username) where ref is not null;
create unique index if not exists hl_notif_log_once on hl_notif_log (username, kind) where kind like 'once:%';
create index if not exists hl_notif_log_unopened on hl_notif_log (username, sent_at desc) where opened_at is null;
create index if not exists hl_notif_log_sent on hl_notif_log (sent_at);
alter table hl_notif_log enable row level security;
revoke all on hl_notif_log from anon, authenticated;

-- Called (throttled) when the app opens: remembers the visit and marks notifications sent in the last 24 h as opened.
create or replace function hl_mark_seen(p_user text, p_country text default null) returns void
language sql set search_path = public as $$
  update hl_profiles set last_seen_at = now(), country = coalesce(p_country, country) where username = p_user;
  update hl_notif_log set opened_at = now() where username = p_user and opened_at is null and sent_at > now() - interval '24 hours';
$$;
revoke all on function hl_mark_seen(text, text) from public, anon, authenticated;
grant execute on function hl_mark_seen(text, text) to service_role;

-- Scheduling for announcements: mode now | at (one absolute time) | local (a chosen hour in each person's own time zone).
alter table hl_broadcasts
  add column if not exists mode text not null default 'now',
  add column if not exists send_at timestamptz,
  add column if not exists local_date date,
  add column if not exists local_hour int check (local_hour between 0 and 23);

drop function if exists hl_broadcast_audience(text, date);
-- audience: all | active7 | inactive3 | inactive7 | ar | en | paying | unpaid | country:XX. Only people who allow announcements.
create function hl_broadcast_audience(p_audience text, p_today date)
returns table (username text, pi_uid text, language text, notify_pi boolean, timezone text)
language sql stable set search_path = public as $$
  select p.username, p.pi_uid, p.language, p.notify_pi, p.timezone
  from hl_profiles p
  where p.deleted_at is null and p.notify_news
    and case
      when p_audience = 'ar' then p.language = 'ar'
      when p_audience = 'en' then p.language = 'en'
      when p_audience = 'active7' then exists (select 1 from hl_user_days d where d.username = p.username and d.day > p_today - 7)
      when p_audience = 'inactive3' then not exists (select 1 from hl_user_days d where d.username = p.username and d.day > p_today - 3)
      when p_audience = 'inactive7' then not exists (select 1 from hl_user_days d where d.username = p.username and d.day > p_today - 7)
      when p_audience = 'paying' then exists (select 1 from hl_purchases u where u.username = p.username and u.status = 'completed')
      when p_audience = 'unpaid' then not exists (select 1 from hl_purchases u where u.username = p.username and u.status = 'completed')
      when p_audience like 'country:%' then p.country = upper(substr(p_audience, 9))
      else true end
  order by p.username
  limit 5000;
$$;
revoke all on function hl_broadcast_audience(text, date) from public, anon, authenticated;
grant execute on function hl_broadcast_audience(text, date) to service_role;

-- Atomically claim up to p_limit people who should get the announcement NOW (once each; for "local" mode only when their own clock has reached the chosen time).
create or replace function hl_claim_broadcast(p_id uuid, p_limit int)
returns table (username text, pi_uid text, language text, notify_pi boolean)
language plpgsql set search_path = public as $$
#variable_conflict use_column
declare b hl_broadcasts%rowtype;
begin
  select * into b from hl_broadcasts where id = p_id;
  if not found or b.status not in ('sending', 'scheduled') then return; end if;
  return query
  with cand as (
    select a.username, a.pi_uid, a.language, a.notify_pi
    from hl_broadcast_audience(b.audience, (now() at time zone 'Africa/Cairo')::date) a
    where not exists (select 1 from hl_notif_log l where l.ref = b.id and l.username = a.username)
      and (b.mode <> 'local' or hl_local_now(a.timezone) >= (b.local_date + make_interval(hours => b.local_hour)))
    limit p_limit
  ), ins as (
    insert into hl_notif_log (username, kind, ref) select c.username, 'broadcast', b.id from cand c on conflict do nothing returning hl_notif_log.username as u
  )
  select c.username, c.pi_uid, c.language, c.notify_pi from cand c join ins i on i.u = c.username;
end $$;
revoke all on function hl_claim_broadcast(uuid, int) from public, anon, authenticated;
grant execute on function hl_claim_broadcast(uuid, int) to service_role;

create or replace function hl_broadcast_add(p_id uuid, p_rec int, p_pi_req int, p_pi_del int, p_dev int, p_sent int) returns void
language sql set search_path = public as $$
  update hl_broadcasts set recipients = recipients + p_rec, pi_requested = pi_requested + p_pi_req, pi_delivered = pi_delivered + p_pi_del,
    push_devices = push_devices + p_dev, push_sent = push_sent + p_sent where id = p_id;
$$;
revoke all on function hl_broadcast_add(uuid, int, int, int, int, int) from public, anon, authenticated;
grant execute on function hl_broadcast_add(uuid, int, int, int, int, int) to service_role;

-- Owner view: how many notifications of each type were sent and how many led to opening the app within 24 h.
create or replace function hl_notif_summary(p_days int) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', k, 'sent', sent, 'opened', opened) order by sent desc), '[]'::jsonb)
  from (select case when kind like 'once:%' then 'event' else kind end as k, count(*) as sent, count(opened_at) as opened
        from hl_notif_log where sent_at > now() - make_interval(days => p_days) group by 1) s;
$$;
revoke all on function hl_notif_summary(int) from public, anon, authenticated;
grant execute on function hl_notif_summary(int) to service_role;

create or replace function hl_broadcast_history() returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
    select b.id, b.audience, b.mode, b.send_at, b.local_date, b.local_hour, b.title_ar, b.body_ar, b.title_en, b.body_en, b.recipients,
      b.pi_requested, b.pi_delivered, b.push_devices, b.push_sent, b.status, b.created_at,
      (select count(opened_at) from hl_notif_log l where l.ref = b.id) as opened
    from hl_broadcasts b order by b.created_at desc limit 15) x;
$$;
revoke all on function hl_broadcast_history() from public, anon, authenticated;
grant execute on function hl_broadcast_history() to service_role;
