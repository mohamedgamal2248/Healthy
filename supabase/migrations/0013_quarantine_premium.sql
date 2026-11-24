-- Quarantine: a saved AI result that breaks the content rules (pork / alcohol / gelatin, a single meal over 900 kcal) is hidden
-- from every list and page but NOT deleted, so it can be reviewed first.
alter table hl_recipes
  add column if not exists hidden boolean not null default false,
  add column if not exists hidden_reason text;
create index if not exists hl_recipes_visible on hl_recipes (username, created_at desc) where hidden = false;

-- The default diet plan uses affordable Egyptian meals only; international / premium meals are an explicit opt-in.
alter table hl_profiles add column if not exists plan_premium boolean not null default false;
