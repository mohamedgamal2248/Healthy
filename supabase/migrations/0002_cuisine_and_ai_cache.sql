alter table hl_meals add column if not exists cuisine text not null default 'egyptian';
alter table hl_meals add column if not exists origin_ar text;
alter table hl_meals add column if not exists origin_en text;
create index if not exists hl_meals_cuisine on hl_meals (cuisine, meal_type, active);
create table if not exists hl_ai_cache (
  key text primary key,
  recipe jsonb not null,
  hits int not null default 0,
  created_at timestamptz not null default now()
);
alter table hl_ai_cache enable row level security;
