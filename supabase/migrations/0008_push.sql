-- Web Push subscriptions (installable app reminders). One row per browser/device.
create table if not exists hl_push_subscriptions (
  endpoint text primary key,
  username text not null references hl_profiles(username) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  failures int not null default 0
);
create index if not exists hl_push_user on hl_push_subscriptions (username);
alter table hl_push_subscriptions enable row level security;
revoke all on hl_push_subscriptions from anon, authenticated;
