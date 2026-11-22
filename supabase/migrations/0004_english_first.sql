alter table hl_meals add column if not exists ingredients_en jsonb;
alter table hl_meals add column if not exists steps_en jsonb;
alter table hl_profiles alter column language set default 'en';
