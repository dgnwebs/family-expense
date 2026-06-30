-- Run once in Supabase → SQL Editor → New query → Run
--
-- Budgets used to be set per month (a separate row for each category+month),
-- requiring you to re-enter the same limit every month. This makes them
-- recurring instead: one limit per category that applies to every month
-- going forward, same as how you'd actually think about a budget.
--
-- This does NOT affect monthly/yearly reports — those aggregate expenses
-- (which already carry their own date), not budgets. The budget is just the
-- limit you're comparing spend against, and now there's exactly one current
-- value per category instead of needing one for every month.

-- If multiple month-specific rows exist for the same category (from before
-- this change), keep only the most recently created one and drop the rest.
delete from budgets a
using budgets b
where a.category_id = b.category_id
  and a.id <> b.id
  and a.created_at < b.created_at;

-- A category can now only have one budget row, period.
alter table budgets drop constraint if exists budgets_category_id_month_key;
alter table budgets add constraint budgets_category_id_unique unique (category_id);

alter table budgets drop column if exists month;
