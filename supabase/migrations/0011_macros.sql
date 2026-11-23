-- Carbs and fat per diary entry (nullable: older rows are estimated from calories and protein when read).
alter table hl_food_log add column if not exists carbs_g numeric(6,1) check (carbs_g is null or carbs_g between 0 and 800);
alter table hl_food_log add column if not exists fat_g numeric(6,1) check (fat_g is null or fat_g between 0 and 400);
-- "Repeat a recent meal" reads the user's last two weeks of entries.
create index if not exists hl_food_user_created on hl_food_log (username, created_at desc);
