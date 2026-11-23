-- Opt-out switch for Pi app (Notification Center) reminders.
alter table hl_profiles add column if not exists notify_pi boolean not null default true;
