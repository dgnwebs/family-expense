-- Run once in Supabase → SQL Editor → New query → Run
--
-- 1. Lets the admin "remove" a family member without deleting their history.
--    Removal is a soft-archive: the member's name/colour stay attached to
--    every expense they were ever paid_by, but they disappear from the
--    active member list and can't be picked for new expenses.
--
-- 2. Tracks who added each expense (created_by), and restricts deletion:
--    - The admin can always delete any expense.
--    - The person who added an expense can delete it within 30 days.
--    - After 30 days, or for any expense added before this feature
--      existed (created_by is null for those — we never tracked it),
--      only the admin can delete it.

alter table members  add column if not exists archived   boolean not null default false;
alter table expenses add column if not exists created_by uuid references auth.users(id) default auth.uid();

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.jwt() ->> 'email' = 'dgnwebs@gmail.com';
$$;

-- Only admin can archive (or later restore) a member
drop policy if exists "Only admin can update members" on members;
create policy "Only admin can update members"
  on members as restrictive for update to authenticated
  using (is_admin());

-- Delete an expense: admin always, or its own adder within 30 days of adding it
drop policy if exists "Own recent expense or admin can delete" on expenses;
create policy "Own recent expense or admin can delete"
  on expenses as restrictive for delete to authenticated
  using (
    is_admin()
    or (created_by = auth.uid() and created_at > now() - interval '30 days')
  );
