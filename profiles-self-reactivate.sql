-- Run once in Supabase → SQL Editor → New query → Run
--
-- Lets a previously-removed member re-request access by signing back in
-- (or signing up again with the same email) — flips their own profile back
-- to 'pending' so the admin sees them in the approval queue again, instead
-- of "User already registered" being a dead end.
--
-- Scoped narrowly on purpose: a user can only update their OWN row, and the
-- with check clause only allows the result to be status = 'pending' — they
-- can never set their own status to 'approved'. That stays admin-only via
-- the existing "Admin updates profiles" policy (this is a second,
-- additional permissive policy — Postgres ORs them together).

drop policy if exists "Users can re-request approval" on profiles;
create policy "Users can re-request approval"
  on profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and status = 'pending');
