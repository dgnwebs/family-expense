-- Run once in Supabase → SQL Editor → New query → Run
-- Restricts expense backdating at the database level:
--   Admin: can use any date (no restriction)
--   All other users: expense date must be within the last 30 days
-- This enforces the rule server-side regardless of client behaviour.

drop policy if exists "Backdate limit for non-admin" on expenses;
create policy "Backdate limit for non-admin"
  on expenses as restrictive for insert to authenticated
  with check (
    is_admin()
    or date::date >= current_date - interval '30 days'
  );
