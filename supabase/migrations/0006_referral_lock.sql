-- Referral reward: serialise per referrer (cap race) and give the invited side at most one referral bonus ever.

create or replace function hl_reward_referral(p_invited text, p_credits int, p_cap int) returns text
language plpgsql set search_path = public as $$
declare v_ref text; v_done int;
begin
  select referrer into v_ref from hl_referrals where invited = p_invited and rewarded = false;
  if v_ref is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext('ref:' || v_ref));
  select referrer into v_ref from hl_referrals where invited = p_invited and rewarded = false for update;
  if v_ref is null then return null; end if;
  -- the invited user can be rewarded only once, even if the referral row was recreated
  if exists (select 1 from hl_credit_ledger where username = p_invited and reason = 'referral') then
    update hl_referrals set rewarded = true where invited = p_invited;
    return null;
  end if;
  select count(*) into v_done from hl_credit_ledger where username = v_ref and reason = 'referral';
  update hl_referrals set rewarded = true where invited = p_invited;
  if v_done >= p_cap then return null; end if;
  insert into hl_credit_ledger (username, change, balance_kind, reason) values (v_ref, p_credits, 'trial', 'referral'), (p_invited, p_credits, 'trial', 'referral');
  return v_ref;
end $$;
