-- The weekly plan's meals are put into the diary once per day (editable and removable), so the day's counters follow the plan.
alter table hl_food_log add column if not exists auto boolean not null default false;
alter table hl_food_log add column if not exists servings numeric(4,2) not null default 1 check (servings between 0.25 and 5);
alter table hl_profiles add column if not exists plan_autolog boolean not null default true;

-- One row per person and day on which the plan's meals were put into the diary (a deleted entry is never added back).
create table if not exists hl_autolog_days (
  username text not null references hl_profiles(username) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  primary key (username, date)
);
alter table hl_autolog_days enable row level security;
revoke all on hl_autolog_days from anon, authenticated;

create or replace function hl_autolog_claim(p_user text, p_date date) returns boolean
language plpgsql set search_path = public as $$
declare v_n int;
begin
  insert into hl_autolog_days (username, date) values (p_user, p_date) on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;
revoke all on function hl_autolog_claim(text, date) from public, anon, authenticated;
grant execute on function hl_autolog_claim(text, date) to service_role;

-- Today's day of the weekly plan plus whether its meals were already put into the diary today.
create or replace function hl_plan_today(p_user text, p_week date, p_date text) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'day', hl_plan_day(p_user, p_week, p_date),
    'filled', exists (select 1 from hl_autolog_days where username = p_user and date = p_date::date)
  );
$$;
revoke all on function hl_plan_today(text, date, text) from public, anon, authenticated;
grant execute on function hl_plan_today(text, date, text) to service_role;
