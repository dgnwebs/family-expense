-- Run once in Supabase → SQL Editor → New query → Run
-- Adds an approval gate: new sign-ups can authenticate (Supabase Auth has no
-- concept of "pending") but cannot read or write any app data until the
-- account owner approves them. Approving auto-creates a family member using
-- their name, same shape as one the admin would add manually.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  member_id uuid references members(id) on delete set null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Users can create their OWN profile row right after signing up. status is
-- forced to 'pending' here — without this check, anyone could insert their
-- own row with status:'approved' directly and bypass approval entirely.
drop policy if exists "Users create own pending profile" on profiles;
create policy "Users create own pending profile"
  on profiles for insert to authenticated
  with check (auth.uid() = id and status = 'pending');

-- Users can read their own profile (to check their approval status). Admin reads all.
drop policy if exists "Read own profile, admin reads all" on profiles;
create policy "Read own profile, admin reads all"
  on profiles for select to authenticated
  using (auth.uid() = id or auth.jwt() ->> 'email' = 'dgnwebs@gmail.com');

-- Only the admin can approve (update) or remove (delete) a profile.
drop policy if exists "Admin updates profiles" on profiles;
create policy "Admin updates profiles"
  on profiles for update to authenticated
  using (auth.jwt() ->> 'email' = 'dgnwebs@gmail.com');

drop policy if exists "Admin deletes profiles" on profiles;
create policy "Admin deletes profiles"
  on profiles for delete to authenticated
  using (auth.jwt() ->> 'email' = 'dgnwebs@gmail.com');

-- One-time backfill: mark everyone ALREADY using the app as approved, so
-- nobody currently active gets locked out the moment this ships. Safe to
-- re-run — ON CONFLICT just skips rows that already exist.
insert into profiles (id, email, name, status)
select id, email, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1)), 'approved'
from auth.users
on conflict (id) do nothing;

-- True for the admin, or any user with an approved profile. Used by the
-- restrictive policies below.
create or replace function is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.jwt() ->> 'email' = 'dgnwebs@gmail.com'
    or exists (select 1 from profiles where id = auth.uid() and status = 'approved');
$$;

-- RESTRICTIVE policies AND together with whatever permissive policies already
-- exist on these tables (from your original schema.sql) — narrowing access to
-- approved users only, without needing to know or replace those policies.
alter table expenses     enable row level security;
alter table members      enable row level security;
alter table budgets      enable row level security;
alter table categories   enable row level security;
alter table note_history enable row level security;

drop policy if exists "Must be approved" on expenses;
create policy "Must be approved" on expenses     as restrictive for all to authenticated using (is_approved()) with check (is_approved());
drop policy if exists "Must be approved" on members;
create policy "Must be approved" on members      as restrictive for all to authenticated using (is_approved()) with check (is_approved());
drop policy if exists "Must be approved" on budgets;
create policy "Must be approved" on budgets      as restrictive for all to authenticated using (is_approved()) with check (is_approved());
drop policy if exists "Must be approved" on categories;
create policy "Must be approved" on categories   as restrictive for all to authenticated using (is_approved()) with check (is_approved());
drop policy if exists "Must be approved" on note_history;
create policy "Must be approved" on note_history as restrictive for all to authenticated using (is_approved()) with check (is_approved());
