-- Run once in Supabase → SQL Editor → New query → Run
-- Creates a table that tracks note phrases per category, independent of the
-- expenses table — so suggestions keep improving even after expenses (and
-- their notes) are deleted.

create table if not exists note_history (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  text text not null,
  count integer not null default 1,
  last_used date,
  created_at timestamptz default now(),
  unique (category_id, text)
);

alter table note_history enable row level security;

drop policy if exists "Allow read for authenticated users" on note_history;
create policy "Allow read for authenticated users"
  on note_history for select to authenticated using (true);

drop policy if exists "Allow insert for authenticated users" on note_history;
create policy "Allow insert for authenticated users"
  on note_history for insert to authenticated with check (true);

drop policy if exists "Allow update for authenticated users" on note_history;
create policy "Allow update for authenticated users"
  on note_history for update to authenticated using (true);

-- One-time backfill: seed history from notes on expenses you've already
-- entered, so existing habits aren't lost when this table is introduced.
-- Safe to re-run — duplicates just bump the count instead of doubling up.
insert into note_history (category_id, text, count, last_used)
select category_id, trim(line) as text, count(*) as count, max(date) as last_used
from expenses, unnest(string_to_array(coalesce(note, ''), E'\n')) as line
where trim(line) <> ''
group by category_id, trim(line)
on conflict (category_id, text) do update
  set count = note_history.count + excluded.count,
      last_used = greatest(note_history.last_used, excluded.last_used);
