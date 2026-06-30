-- Run once in Supabase → SQL Editor → New query → Run
--
-- Allows "declined" as a profile status. Declining a sign-up now records
-- that decision instead of deleting the row outright — a deleted row was
-- indistinguishable from a failed sign-up insert (which the app
-- auto-recovers from by recreating a pending request), so refreshing the
-- page after being declined was resurrecting the request as pending again.

alter table profiles drop constraint if exists profiles_status_check;
alter table profiles add constraint profiles_status_check check (status in ('pending', 'approved', 'declined'));
