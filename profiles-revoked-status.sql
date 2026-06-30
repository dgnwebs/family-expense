-- Run once in Supabase → SQL Editor → New query → Run
--
-- Adds "revoked" as a distinct status from "declined" — they're different
-- events and the data should say which one happened:
--   declined  = a new sign-up request was rejected (never had access)
--   revoked   = an approved member's access was removed (had access, lost it)
-- Both behave identically for access purposes (blocked, can re-request by
-- signing in again), this is purely for a clean, honest audit trail.

alter table profiles drop constraint if exists profiles_status_check;
alter table profiles add constraint profiles_status_check check (status in ('pending', 'approved', 'declined', 'revoked'));
