-- Quick start: free AI credits for the first useful actions (once per account per step).
alter table hl_profiles add column if not exists reminder_set_at timestamptz;

create table if not exists hl_quickstart (
  username text not null references hl_profiles(username) on delete cascade,
  step text not null check (step in ('profile', 'meal', 'reminder')),
  credits int not null,
  granted_at timestamptz not null default now(),
  seen boolean not null default false,
  primary key (username, step)
);
alter table hl_quickstart enable row level security;
revoke all on hl_quickstart from anon, authenticated;

alter table hl_credit_ledger drop constraint if exists hl_credit_ledger_reason_check;
alter table hl_credit_ledger add constraint hl_credit_ledger_reason_check check (reason in ('trial_grant','purchase','plan_grant','generation','refund','expiry','referral','quickstart'));

-- Atomic and idempotent: the first claim of a step inserts the row and the credits together; any repeat does nothing.
create or replace function hl_quickstart_claim(p_user text, p_step text, p_credits int) returns boolean
language plpgsql set search_path = public as $$
declare v_n int;
begin
  perform pg_advisory_xact_lock(hashtext('qs:' || p_user));
  insert into hl_quickstart (username, step, credits) values (p_user, p_step, p_credits) on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return false; end if;
  insert into hl_credit_ledger (username, change, balance_kind, reason) values (p_user, p_credits, 'trial', 'quickstart');
  return true;
end $$;
revoke all on function hl_quickstart_claim(text, text, int) from public, anon, authenticated;
grant execute on function hl_quickstart_claim(text, text, int) to service_role;

-- Owner funnel: how many people reached each step and how many credits were given.
create or replace function hl_quickstart_funnel() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'users', (select count(*) from hl_profiles where deleted_at is null),
    'profile', (select count(*) from hl_quickstart where step = 'profile'),
    'meal', (select count(*) from hl_quickstart where step = 'meal'),
    'reminder', (select count(*) from hl_quickstart where step = 'reminder'),
    'all_three', (select count(*) from (select username from hl_quickstart group by username having count(*) = 3) x),
    'credits', (select coalesce(sum(credits), 0) from hl_quickstart)
  );
$$;
revoke all on function hl_quickstart_funnel() from public, anon, authenticated;
grant execute on function hl_quickstart_funnel() to service_role;
