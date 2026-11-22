alter table hl_profiles add column if not exists timezone_changed_at timestamptz;
alter table hl_referrals add constraint hl_referrals_not_self check (invited <> referrer);
