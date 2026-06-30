-- Run once in Supabase → SQL Editor → New query → Run
-- Backfills the email column on existing members that were approved before
-- approveProfile started saving it — matches via the existing member_id
-- link on profiles. Safe to re-run.

update members m
set email = p.email
from profiles p
where p.member_id = m.id
  and m.email is null;
