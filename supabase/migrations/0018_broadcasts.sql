-- Owner announcements sent to many users at once. One row per send; the primary key is chosen by the page, so a double click cannot send twice.
create table if not exists hl_broadcasts (
  id uuid primary key,
  admin text not null,
  audience text not null,
  subroute text not null default '/today',
  title_ar text, body_ar text, title_en text, body_en text,
  recipients int not null default 0,
  pi_requested int not null default 0,
  pi_delivered int not null default 0,
  push_devices int not null default 0,
  push_sent int not null default 0,
  status text not null default 'sending',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists hl_broadcasts_created on hl_broadcasts (created_at desc);
alter table hl_broadcasts enable row level security;
revoke all on hl_broadcasts from anon, authenticated;

-- Who an announcement goes to. audience: all | inactive7 (not opened for 7+ days) | active7 (opened in the last 7 days) | ar | en
create or replace function hl_broadcast_audience(p_audience text, p_today date)
returns table (username text, pi_uid text, language text, notify_pi boolean)
language sql stable set search_path = public as $$
  select p.username, p.pi_uid, p.language, p.notify_pi
  from hl_profiles p
  where p.deleted_at is null
    and case p_audience
      when 'ar' then p.language = 'ar'
      when 'en' then p.language = 'en'
      when 'active7' then exists (select 1 from hl_user_days d where d.username = p.username and d.day > p_today - 7)
      when 'inactive7' then not exists (select 1 from hl_user_days d where d.username = p.username and d.day > p_today - 7)
      else true end
  order by p.username
  limit 5000;
$$;
revoke all on function hl_broadcast_audience(text, date) from public, anon, authenticated;
grant execute on function hl_broadcast_audience(text, date) to service_role;
