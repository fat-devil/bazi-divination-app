create table if not exists public.bazi_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  gender text not null,
  birth_date date not null,
  birth_time time not null,
  birth_place text not null,
  province text,
  city text,
  county text,
  longitude numeric,
  use_true_solar_time boolean not null default false,
  pillars_result jsonb not null,
  bazi_result jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.bazi_profiles enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, delete on table public.bazi_profiles to authenticated;

drop policy if exists "Users can read own bazi profiles" on public.bazi_profiles;
create policy "Users can read own bazi profiles"
on public.bazi_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own bazi profiles" on public.bazi_profiles;
create policy "Users can insert own bazi profiles"
on public.bazi_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bazi profiles" on public.bazi_profiles;
create policy "Users can delete own bazi profiles"
on public.bazi_profiles
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists bazi_profiles_user_created_idx
on public.bazi_profiles (user_id, created_at desc);
