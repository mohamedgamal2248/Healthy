-- Just today's day of the person's weekly plan (a few hundred bytes), so the Today page does not download the whole plan.
create or replace function hl_plan_day(p_user text, p_week date, p_date text) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_path_query_first(plan, '$.days[*] ? (@.date == $d)', jsonb_build_object('d', p_date))
  from hl_diet_plans where username = p_user and week_start = p_week;
$$;
revoke all on function hl_plan_day(text, date, text) from public, anon, authenticated;
grant execute on function hl_plan_day(text, date, text) to service_role;
