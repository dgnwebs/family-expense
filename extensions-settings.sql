-- Run once in Supabase → SQL Editor → New query → Run
-- Creates the settings table used to store extension toggles and any
-- other app-wide configuration. Designed to grow: each extension or
-- feature gets its own row keyed by a stable string identifier.

create table if not exists settings (
  key         text primary key,
  value       jsonb not null default '{}',
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz default now()
);

alter table settings enable row level security;

-- All approved users can read settings so the UI knows what's active.
drop policy if exists "Approved users can read settings" on settings;
create policy "Approved users can read settings"
  on settings for select to authenticated
  using (is_approved());

-- Only admin can create or modify settings.
drop policy if exists "Admin can manage settings" on settings;
create policy "Admin can manage settings"
  on settings for all to authenticated
  using (is_admin())
  with check (is_admin());

-- Seed the first extension in its default (disabled) state.
-- ON CONFLICT means it's safe to re-run this script.
insert into settings (key, value)
values ('ext_edit_expense_category', '{"enabled": false}')
on conflict (key) do nothing;
