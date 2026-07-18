# Family Expenses — Project Documentation

A single-page PWA for a household to track shared spending: who paid, on what category, how much, and whether it's within budget. Built as one React app talking directly to Supabase (Postgres + Auth) over REST — no custom backend server.

- **Live app:** https://dgnwebs.github.io/family-expense/
- **Repo:** https://github.com/dgnwebs/family-expense (remote name `origin`)
- **Admin/owner account:** dgnwebs@gmail.com (hardcoded as `ADMIN_EMAIL` in the app and mirrored in every Supabase RLS policy)

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, single file (`src/App.jsx`, ~2540 lines) |
| Build | Vite 8, base path `/family-expense/` |
| Backend | Supabase — Postgres via PostgREST (`/rest/v1/...`), GoTrue auth (`/auth/v1/...`) |
| Hosting | GitHub Pages, deployed via `gh-pages` package |
| Styling | Plain CSS-in-JS template string (`STYLES` const), CSS custom properties for theming, no CSS framework |
| PWA | Custom service worker (`public/sw.js`), manifest, iOS-specific meta tags |
| Lint | oxlint (`.oxlintrc.json`) — `react/rules-of-hooks`, `react/only-export-components` |
| Notifications | EmailJS (client-side, no server) — emails admin on new sign-up |

No component libraries, no CSS framework, no state management library, no router (tab state is a plain `useState`). Deliberately minimal dependency footprint — see `package.json`: only `react`, `react-dom` as runtime deps.

## Project layout

```
src/
  App.jsx      — entire application: API layer, all screens, all modals, styles
  main.jsx     — React root + service-worker registration/update logic
public/
  sw.js               — network-first service worker (see below)
  manifest.json       — PWA manifest, scope /family-expense/
  icon-*.png, icons.svg
index.html
vite.config.js        — base: '/family-expense/'
*.sql                  — one-off migration scripts, run manually in Supabase SQL Editor (no migration tool)
```

### Why one giant App.jsx
This was built iteratively in a single file rather than split into components/modules. All screens (`ScreenDash`, `ScreenExp`, `ScreenBud`, `ScreenAdm`), all modals (`ModalAdd`, `ModalDet`, `ModalMem`, `ModalCat`, `ModalBud`), and shared helpers live as top-level functions in that one file. There's no `src/components/` directory — if you're looking for a piece of UI, grep `App.jsx` for the function name (see component map below).

## Supabase project

- URL: `https://draniousnxunkgqdxxvw.supabase.co` (hardcoded in `App.jsx` as `SUPA_URL`)
- Auth: email/password only (GoTrue), no OAuth providers
- Anon key is hardcoded client-side in `App.jsx` (`SUPA_KEY`) — normal for Supabase's anon key, since access control is enforced by Postgres Row Level Security (RLS), not by hiding the key
- All data access goes through PostgREST (`/rest/v1/<table>`), called via a tiny `api` wrapper (`get/post/patch/del`) in `App.jsx`

### Tables (inferred from SQL scripts + app usage)

| Table | Purpose | Key columns |
|---|---|---|
| `expenses` | Individual spend records | `category_id`, `paid_by`, `amount`, `date`, `note`, `created_by`, `created_at` |
| `members` | Family members who can be "paid by" | `name`, `color`, `initials`, `email`, `archived` |
| `categories` | Expense categories | `name`, `icon`, `color` |
| `budgets` | One recurring limit per category (not per-month) | `category_id` (unique), `limit_amount` |
| `note_history` | Learned note phrases per category, survives expense deletion | `category_id`, `text`, `count`, `last_used`, unique on `(category_id, text)` |
| `profiles` | Auth-user ↔ approval-status ↔ member link | `id` (= auth.users.id), `email`, `name`, `status`, `member_id` |
| `settings` | App-wide key/value config (extension toggles etc.) | `key` (PK), `value` (jsonb), `updated_by`, `updated_at` |

### SQL migration scripts (run manually, in order of introduction)

There is no migration framework — each `.sql` file in the repo root is a standalone, idempotent script meant to be pasted into the Supabase SQL Editor once. Filenames describe intent:

1. `approval-system.sql` — creates `profiles`, the `is_approved()` function, and RESTRICTIVE RLS policies gating all app tables behind approval
2. `admin-categories-rls.sql` — categories are admin-write, everyone-read
3. `note-history.sql` — creates `note_history` + backfills from existing expense notes
4. `budgets-recurring.sql` — collapses per-month budget rows into one recurring row per category
5. `member-archive-expense-delete.sql` — soft-archive members (`archived` column), adds `created_by` to expenses, `is_admin()` function, 30-day self-delete window for expense creators
6. `backfill-member-emails.sql` — one-time backfill of `members.email` from `profiles`
7. `profiles-declined-status.sql` — adds `declined` status (distinct from a deleted row)
8. `profiles-revoked-status.sql` — adds `revoked` status (distinct from `declined` — lost access vs. never had it)
9. `profiles-self-reactivate.sql` — lets a removed/declined user re-request access by signing in again
10. `expense-backdate-limit.sql` — non-admins can't backdate expenses more than 30 days
11. `extensions-settings.sql` — creates `settings` table for the Extensions system
12. `reset-test-data.sql` — dev utility, wipes `expenses`/`members`/non-admin `profiles` for a clean sign-up test (**not a migration** — destructive, run only intentionally)

**When adding a new feature that touches the schema:** add a new numbered/dated `.sql` file rather than editing an old one — old scripts are historical record and must stay re-runnable (`if not exists`, `drop policy if exists`, `on conflict do nothing` throughout).

## Authentication & authorization model

- **Auth:** Supabase GoTrue, email+password. Sessions persisted in `localStorage` under `fe_session` with a 30-day rolling access window; access tokens (1hr TTL) are silently refreshed via the stored refresh token on load.
- **Approval gate:** signing up creates an auth user immediately, but a `profiles` row with `status: 'pending'` blocks all data access until the admin approves. RLS is enforced at the Postgres level via `is_approved()` — the client-side gate is UX only, not the actual security boundary.
- **Statuses:** `pending → approved`, or `pending → declined` (rejected before ever approved) / `approved → revoked` (admin removed a member). Both blocked states can self-reactivate to `pending` by signing in again (`profiles-self-reactivate.sql`).
- **Live status polling:** every 10s while logged in, the app re-checks the caller's own profile row — so a revoke takes effect (signs the user out client-side) within ~10s, on top of RLS already blocking their requests instantly.
- **Admin:** identified purely by `auth.jwt() ->> 'email' = 'dgnwebs@gmail.com'` (`is_admin()` in Postgres, `ADMIN_EMAIL` constant in the client). Admin bypasses the approval gate entirely and can edit/delete categories, approve/decline sign-ups, archive members, and toggle Extensions.
- **Password reset:** `/auth/v1/recover` with `redirect_to` as a **query param** (not JSON body — GoTrue only reads it from the URL). Client-side rate-limited: 60s cooldown between requests, max 3/day, tracked in `localStorage`. The reset link opens the app with a `#type=recovery&access_token=...` hash, which routes to the `ResetPassword` screen using that temporary token (not the normal session token) to call `PUT /auth/v1/user`.

## App structure (screens & component map)

Root component is `App()` (`src/App.jsx:865`). It owns all top-level state (auth, data, active tab, modal, dashboard date-range) and renders one of four tabs plus stacked modals.

| Tab | Component | Purpose |
|---|---|---|
| Dashboard | `ScreenDash` | Hero total for Today/Week/Month, category breakdown, budget alerts, recent expenses, "who paid" |
| Expenses | `ScreenExp` | Full list, filterable, bulk-delete (admin), new-expense badge count |
| Budgets | `ScreenBud` | Recurring per-category limits vs. month-to-date spend |
| Manage (admin) | `ScreenAdm` | Sub-tabs: Members, Categories, Reports, Settings, and (admin-only) Extensions |

Modals (all rendered from root `App`, driven by a single `modal` state string): `ModalAdd` (new expense), `ModalDet` (expense detail/edit/delete), `ModalMem` (add member), `ModalCat` (add/edit category), `ModalBud` (edit budget).

Login-adjacent screens (rendered instead of the tabbed app when not authenticated/approved): `Login`, `ForgotPasswordLink`, `ResetPassword`, `AwaitingApproval`.

Shared helpers worth knowing about:
- `api` (get/post/patch/del) — thin PostgREST wrapper, always `cache: 'no-store'` (a fetch cache bug once made pull-to-refresh silently do nothing)
- `todayS()` / date helpers — "today" is always **India Standard Time**, not device timezone, since this is an India-based household app; date arithmetic is done in UTC internally to avoid local-timezone off-by-one bugs
- `noteSuggestions()` / `note_history` — autocomplete for the expense note field, learns from actual usage per category, falls back to a static generic lexicon only when a category has zero history
- Session helpers (`saveSession`/`getRawSession`/`clearSession`) — 30-day persistent login pattern

## Responsive design

Single codebase serves both phone and tablet via one `@media (min-width: 768px)` block in `STYLES`:
- **Phone (<768px):** bottom tab bar, single-column screens, 430px max-width capped/centered layout
- **Tablet (≥768px):** bottom nav becomes a left sidebar (via `order: -1` CSS trick, not DOM reorder), dashboard becomes a 2-column grid, hero card becomes a single row instead of stacked

Font scaling (Settings → Text size) is implemented via CSS `transform: scale()` on the whole `.app` container rather than changing font-size directly — chosen deliberately over the non-standard `zoom` property for predictable box-sizing across browsers.

## PWA / offline behavior

- `public/sw.js` is deliberately **not** an offline-cache service worker — it exists purely to force every request to bypass the HTTP cache (`cache: 'no-store'`) and to nuke all old caches on activation, so installed devices never get stuck on a stale JS bundle. Freshness over offline support.
- On `visibilitychange`, if the app was backgrounded for **more than 4 hours**, it force-reloads — iOS PWAs can resume from a memory snapshot without re-fetching, silently running stale code otherwise.
- `main.jsx` also proactively calls `registration.update()` every time the tab becomes visible again, rather than waiting on the browser's own (often ~24h) check interval.

## Extensions system

A settings-table-backed feature-flag mechanism for admin-togglable "paid" capabilities, introduced in `extensions-settings.sql` / commit `9808a94`. Pattern for adding a new one:
1. Add a new `settings` row default (usually `{"enabled": false}`) via a new SQL script
2. Add an `<ExtensionCard>` block in `ScreenAdm`'s `t === "extensions"` section
3. Gate the actual behavior elsewhere in the app on `appSettings["ext_your_key"]?.enabled`

Currently shipped: **Edit Expenses** (`ext_edit_expense_category`) — lets admin edit any field (category, amount, date, note) on an existing expense via `ModalDet`, not just delete-and-recreate.

## Known deferred work

- **SMTP / password-reset email delivery** is running on Supabase's default (rate-limited, not production-grade) email sending — flagged as the next item in the broader production-hardening plan, not yet addressed.
- No automated tests exist in the repo (no test runner configured in `package.json`).
- No TypeScript — plain JSX, oxlint only (no type-aware linting).

## Common workflows

```bash
npm run dev       # vite dev server
npm run build      # production build to dist/
npm run deploy     # build + publish dist/ to gh-pages branch
npm run lint       # oxlint
```

Schema changes: write a new `.sql` file in the repo root, run it manually in the Supabase SQL Editor, commit the file (it's the only record of that migration — there's no `supabase/migrations` folder or CLI in use).
