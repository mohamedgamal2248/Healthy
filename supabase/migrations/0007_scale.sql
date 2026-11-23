-- Scale: aggregate in SQL instead of pulling thousands of rows into the server; keep balance reads write-free.

-- Same FNV-1a hash the app uses (src/lib/dates.ts hash) so teams can be counted in SQL.
create or replace function hl_fnv(s text) returns bigint language plpgsql immutable set search_path = public as $$
declare h bigint := 2166136261; i int; b int;
begin
  for i in 1..length(s) loop
    b := ascii(substr(s, i, 1));
    h := ((h # b) * 16777619) % 4294967296;
  end loop;
  return h;
end $$;

alter table hl_group_challenge_members add column if not exists team text;
update hl_group_challenge_members set team = case when hl_fnv(username) % 2 = 0 then 'olive' else 'gold' end where team is null;
create index if not exists hl_gcm_rank on hl_group_challenge_members (group_id, days_completed desc);

create or replace function hl_team_totals(p_group uuid) returns table (team text, members bigint, days bigint)
language sql stable set search_path = public as $$
  select coalesce(team, case when hl_fnv(username) % 2 = 0 then 'olive' else 'gold' end), count(*), coalesce(sum(days_completed), 0)
  from hl_group_challenge_members where group_id = p_group group by 1;
$$;

create or replace function hl_month_board(p_from date, p_to date, p_limit int) returns table (username text, days bigint)
language sql stable set search_path = public as $$
  select c.username, count(*) as days
  from hl_group_challenge_checks c
  join hl_profiles p on p.username = c.username and p.kyc_verified and p.leaderboard_visible and p.deleted_at is null
  where c.date between p_from and p_to
  group by c.username order by days desc, c.username limit p_limit;
$$;

create or replace function hl_group_counts(p_group uuid, p_date date) returns table (members bigint, checked bigint)
language sql stable set search_path = public as $$
  select (select count(*) from hl_group_challenge_members where group_id = p_group),
         (select count(*) from hl_group_challenge_checks where group_id = p_group and date = p_date);
$$;

-- Reading balances must not take locks or write unless a plan really has to be settled.
create or replace function hl_credit_balances(p_user text)
returns table (plan int, pack int, trial int, plan_expires_at timestamptz) language plpgsql set search_path = public as $$
begin
  if exists (select 1 from hl_subscriptions s where s.username = p_user and s.expires_at <= now())
     and coalesce((select sum(change) from hl_credit_ledger where username = p_user and balance_kind = 'plan'), 0) > 0 then
    perform pg_advisory_xact_lock(hashtext(p_user));
    perform hl_settle_plan_expiry(p_user);
  end if;
  return query
    select
      coalesce(sum(change) filter (where balance_kind = 'plan'), 0)::int,
      coalesce(sum(change) filter (where balance_kind = 'pack'), 0)::int,
      coalesce(sum(change) filter (where balance_kind = 'trial'), 0)::int,
      (select expires_at from hl_subscriptions where username = p_user)
    from hl_credit_ledger where username = p_user;
end $$;

revoke all on function hl_fnv(text), hl_team_totals(uuid), hl_month_board(date, date, int), hl_group_counts(uuid, date), hl_credit_balances(text) from public, anon, authenticated;
