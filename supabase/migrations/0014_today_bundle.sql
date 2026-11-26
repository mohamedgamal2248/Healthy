-- Today screen in one round trip: everything per-user that /api/today used to read with ~12 separate queries.
-- Read-only (apart from the plan-expiry settlement hl_credit_balances may do). Server-only: callable by service_role.
create or replace function hl_today_bundle(p_user text, p_today date, p_week date, p_kyc boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_group uuid;
  v_bal jsonb := null;
begin
  if p_kyc then
    select to_jsonb(b) into v_bal from hl_credit_balances(p_user) b limit 1;
  end if;
  select id into v_group from hl_group_challenges where week_start = p_week limit 1;
  return jsonb_build_object(
    'streak', (select to_jsonb(s) from (select current_streak, longest_streak, last_completed_date, total_completed, freeze_used_on from hl_streaks where username = p_user) s),
    'badges', coalesce((select jsonb_agg(jsonb_build_object('badge_key', badge_key, 'earned_at', earned_at)) from hl_badges where username = p_user), '[]'::jsonb),
    'favs', coalesce((select jsonb_agg(source_id) from hl_favourites where username = p_user and source_type = 'meal'), '[]'::jsonb),
    'last_habit', (select max(date) from hl_habit_logs where username = p_user),
    'trial', exists (select 1 from hl_credit_ledger where username = p_user and reason = 'trial_grant'),
    'coach', exists (select 1 from hl_recipes where username = p_user and hidden = false),
    'done', coalesce((select jsonb_agg(distinct date) from hl_user_challenges where username = p_user and status = 'completed' and date between p_today - 6 and p_today), '[]'::jsonb),
    'food', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc) from (
        select id, name, calories, protein_g, carbs_g, fat_g, source, source_id, created_at, date
        from hl_food_log where username = p_user and date between p_today - 14 and p_today
        order by created_at desc limit 600) f), '[]'::jsonb),
    'plan_target', (select daily_calorie_target from hl_diet_plans where username = p_user and week_start = p_week limit 1),
    'group_days', case when v_group is null or not p_kyc then null else (select days_completed from hl_group_challenge_members where group_id = v_group and username = p_user) end,
    'group_joined', case when v_group is null or not p_kyc then false else exists (select 1 from hl_group_challenge_members where group_id = v_group and username = p_user) end,
    'balances', v_bal
  );
end $$;

revoke all on function hl_today_bundle(text, date, date, boolean) from public, anon, authenticated;
grant execute on function hl_today_bundle(text, date, date, boolean) to service_role;
