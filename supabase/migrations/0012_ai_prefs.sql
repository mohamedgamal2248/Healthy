-- AI preferences: chosen once by the user, sent with every AI request so answers fit them.
-- Allergies and dislikes are hard constraints on recipes; equipment / level / joints shape workouts.
alter table hl_profiles
  add column if not exists allergies text[] not null default '{}',
  add column if not exists dislikes text,
  add column if not exists equipment text[] not null default '{}',
  add column if not exists fitness_level text check (fitness_level in ('beginner','intermediate','advanced')),
  add column if not exists avoid_joints text[] not null default '{}',
  add column if not exists household int check (household between 1 and 8);
