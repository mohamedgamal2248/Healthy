-- Why requests failed with a 4xx (bad input, expired session, rate limit...): counted per route, status and error code. No user data.
create table if not exists hl_api_client_errors (
  key text primary key,
  route text not null,
  status int not null,
  code text not null,
  n int not null default 0,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create index if not exists hl_api_client_errors_last on hl_api_client_errors (last_at desc);
alter table hl_api_client_errors enable row level security;
revoke all on hl_api_client_errors from anon, authenticated;

create or replace function hl_client_err_flush(p_errors jsonb) returns void
language sql set search_path = public as $$
  insert into hl_api_client_errors (key, route, status, code, n)
  select left((e->>'route') || '|' || (e->>'status') || '|' || (e->>'code'), 200), left(e->>'route', 100), (e->>'status')::int, left(e->>'code', 60), (e->>'n')::int
  from jsonb_array_elements(coalesce(p_errors, '[]'::jsonb)) e
  on conflict (key) do update set n = hl_api_client_errors.n + excluded.n, last_at = now();
$$;
revoke all on function hl_client_err_flush(jsonb) from public, anon, authenticated;
grant execute on function hl_client_err_flush(jsonb) to service_role;

create or replace function hl_client_errors() returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc), '[]'::jsonb)
  from (select route, status, code, n, first_at, last_at from hl_api_client_errors where last_at > now() - interval '24 hours' order by n desc limit 30) x;
$$;
revoke all on function hl_client_errors() from public, anon, authenticated;
grant execute on function hl_client_errors() to service_role;
