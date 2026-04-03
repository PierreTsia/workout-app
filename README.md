# Workout App

A mobile-first PWA for tracking strength training sessions — with offline support, progression tracking, and workout analytics.

Built with React 19, TypeScript, Supabase, and Tailwind CSS.

---

## Features

### Onboarding & programs
- First-run **onboarding** (profile / equipment) before the main app
- **Create program** flow: pick a **template**, start **blank**, or build an **AI-generated** multi-day program (constraints wizard, preview, confirm) via Supabase Edge Function + Gemini
- Template path resolves **equipment swaps** using the exercise alternatives catalog where needed
- **Onboarding guard**: main shell routes require an active program; users without one are guided through `/create-program`

### Workout session
- Day selector and horizontal **exercise strip**; per-exercise **sets table** (reps, weight, done checkbox)
- **RIR (reps in reserve)** per set, with **in-session load suggestions** for the next set based on the previous set’s RIR
- Full-screen **rest timer** (countdown, audio, vibration, notifications) and **session timer**; **session summary** on completion
- **Last session** reference per exercise
- **Exercise detail**: structured **instructions**, YouTube demo (lazy thumbnails), illustration, **body-map** muscle highlight (`react-body-highlighter`), and an **exercise history** sheet (past sessions + trend chart)
- **Quick workout**: generate a **single ad-hoc session** with AI (constraints + Edge Function) when you want something off-program
- **Offline-first**: set logs and session completion are **queued** and synced when back online (see below)

### Training cycles
- Sessions can be linked to a **training cycle**; **cycle summary** route surfaces completion stats and history for a finished cycle
- “Quick” / off-cycle sessions avoid attaching to the active cycle when appropriate

### Progression & PRs
- **Epley estimated 1RM** from logged sets; **automatic PR detection** with a **PR badge** on the exercise strip when you beat your previous best
- `estimated_1rm`, `was_pr`, and **RIR** persisted on `set_logs` for history and suggestions

### History & analytics
- **Stats** dashboard (sessions, sets, PRs, etc.) and reverse-chronological **session list** with expandable details
- Per-exercise **1RM-over-time** charts (Recharts)
- **Workout overview** cards with muscle coverage / body-map style summaries where the UI presents them

### Workout library
- Dedicated **`/library`** page: large **exercise catalog** (~600+ items) with search, **muscle group** and **equipment** filters, and **difficulty** badges / filtering where data exists
- Rich catalog metadata: FR/EN names, instructions (JSON sections), YouTube URLs, illustrations, secondary muscles, provenance

### Workout builder
- Full **CRUD** for **programs** (workout days and slot exercises)
- **Exercise library picker** (search + filters, cmdk) and **drag-and-drop** reorder (dnd-kit)
- Snapshot fields on `workout_exercises` keep exercise copy stable when catalog content changes
- **Online-only** editing with a clear offline state

### Exercise content & feedback
- Users can **report content issues** from multiple entry points; **admins** triage feedback from the admin area

### Offline-first sync
- `SyncService` queues set logs and session finishes in **localStorage** with **fingerprint-based deduplication**
- Queue **drains** on reconnect and on load when authenticated
- **Sync status** chip in the UI

### PWA & shell
- Install prompt (banner + settings), **Workbox** service worker (app shell + runtime caching for Supabase API), standalone display
- **Route-level error boundaries** for failed navigations / lazy chunks
- Bottom nav + drawer **App shell** for workout, history, builder, library

### Internationalization & theming
- **FR / EN** via react-i18next with **per-feature namespaces** (e.g. workout, history, builder, onboarding, create-program, library, generator, admin, exercise, settings, errors)
- **kg / lbs** display preference (storage in kg)
- **Dark / light** theme via next-themes

### Auth & admin
- **Google OAuth** via Supabase Auth; **AuthGuard** on protected routes
- Notification permission prompt for timer / alerts
- **Admin**: exercise review (`/admin/exercises`) and **feedback triage** (`/admin/feedback`), gated by `admin_users`

### Quality
- **Vitest** + Testing Library (Epley, weight units, SyncService, hooks, key components)
- **Playwright** E2E (login, workout, builder, onboarding paths as covered in `e2e/`)
- **GitHub Actions**: lint, type-check, unit tests, E2E against **local Supabase**, deploy (e.g. Vercel)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build | Vite 7 |
| Language | TypeScript 5.9 |
| State | Jotai (atomWithStorage for persistence) |
| Server state | TanStack React Query 5 |
| Backend | Supabase (Postgres + Auth + RLS) |
| UI components | shadcn/ui (Radix primitives) |
| Styling | Tailwind CSS 3.4 + tailwindcss-animate |
| Charts | Recharts |
| Drag & drop | dnd-kit |
| i18n | react-i18next + i18next-browser-languagedetector |
| Icons | lucide-react |
| PWA | vite-plugin-pwa (Workbox) |
| Theming | next-themes |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (or the Supabase CLI for local dev)

### Setup

```bash
git clone https://github.com/PierreTsia/workout-app.git
cd workout-app
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Fill in your Supabase credentials (hosted project):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For **local Supabase**, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `supabase status` in **`.env.local`** (see [Local Supabase development](#local-supabase-development)).

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

---

## Local Supabase development

Use a local stack so day-to-day usage and experiments do not write to production. Requires [Docker](https://docs.docker.com/get-docker/) and the [Supabase CLI](https://supabase.com/docs/guides/cli).

### npm scripts

| Script | Command |
|--------|---------|
| `npm run supabase:start` | `supabase start` — Postgres, Auth, Studio, Storage, etc. |
| `npm run supabase:stop` | `supabase stop` — stops containers; data stays in Docker volumes |
| `npm run supabase:reset` | `supabase db reset` — re-runs **all** migrations + `seed.sql` (**wipes local user data**) |

### Typical workflow

1. `npm run supabase:start`
2. Copy **API URL** and **anon key** from `supabase status` into **`.env.local`** as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (point at `http://127.0.0.1:54321`, not `*.supabase.co`).
3. `npm run dev`
4. When you need a clean database: `npm run supabase:reset` (stack must already be running).

The app reads Supabase URL/anon key from Vite env (`import.meta.env`). Restart `npm run dev` after changing env files.

### Environment files (important)

| File | Who reads it | Purpose |
|------|----------------|---------|
| **`.env.local`** | Vite (`npm run dev`, `npm run build` locally) | `VITE_*` for the browser client — use for local API URL + anon key |
| **`.env`** (project root) | **Supabase CLI** when parsing `supabase/config.toml` | `env(...)` placeholders (e.g. Google OAuth for local Auth). **The CLI does not load `.env.local`.** |
| **Vercel / CI** | Production builds | Set `VITE_*` in the dashboard; nothing from `.env.local` is deployed |

Duplicate keys where both tools need them (e.g. Google client id/secret in **`.env`** for `supabase start`, plus whatever you use elsewhere).

### Service URLs and ports (default)

| Port | Service |
|------|---------|
| **54321** | REST / Auth / Edge Functions API (`VITE_SUPABASE_URL`) |
| **54322** | Postgres (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) |
| **54323** | [Supabase Studio](http://127.0.0.1:54323) — table editor, SQL, Auth users |
| **54324** | [Inbucket](http://127.0.0.1:54324) — captures auth emails locally (magic links, etc.) |

### Inspecting tables and data

- **Studio** at `http://127.0.0.1:54323` is the default place to browse tables and run SQL.
- Any Postgres client can use the DB URL above for heavier querying.

### Google Sign-In locally

`supabase/config.toml` enables Google when the corresponding vars exist in **project-root `.env`**. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your **Web** OAuth client:

- **Authorized redirect URIs** must include exactly:  
  `http://127.0.0.1:54321/auth/v1/callback`  
  (Supabase Auth receives the OAuth callback here — **not** `http://127.0.0.1:5173/...`.)
- Keep your hosted callback too if you use the same client for prod, e.g.  
  `https://<project-ref>.supabase.co/auth/v1/callback`
- **Authorized JavaScript origins** should include your dev app origin, e.g. `http://localhost:5173` and `http://127.0.0.1:5173`.

After changing `config.toml` or `.env` auth vars, run `npm run supabase:stop` then `npm run supabase:start`.

### Schema and seed

- Migrations: `supabase/migrations/`
- Seed data (e.g. exercise catalog): `supabase/seed.sql` (applied on `supabase db reset`)
- Prefer **new migration files** for schema changes rather than only editing data in Studio, so git stays the source of truth.

### History / Activity / calendar dev data (local)

Login is **Google-only** in the app, so session history cannot be tied to a fixed email in `seed.sql` for your real account. Use the **service-role** script instead:

1. `npm run supabase:start` (or ensure local API is up).
2. Sign in once with **Google**, then copy your user id from **Supabase Studio** → **Authentication** → **Users** (or run `select id, email from auth.users` in the SQL editor).
3. Run:

```bash
npm run seed:history -- --user-id=<your-auth-uuid>
```

Or set `SUPABASE_HISTORY_SEED_USER_ID` in `.env.local` and run `npm run seed:history`.

To **list user ids** on the same instance the script will hit:

```bash
npm run seed:history -- --list-users
```

**Target URL:** the script defaults to **`http://127.0.0.1:54321`** (local Supabase CLI). It **does not** read `VITE_SUPABASE_URL`, so a `.env` pointed at hosted prod will not send seed data to production.

Override only when you mean it:

- `SUPABASE_HISTORY_SEED_URL` or `SEED_SUPABASE_URL`, or
- `npm run seed:history -- --url=https://….supabase.co --user-id=…` (then you **must** set `SUPABASE_SERVICE_ROLE_KEY` for that project).

If you see `sessions_user_id_fkey`, the UUID is **not** in `auth.users` for that URL—typical causes: id from another Supabase project, or **`supabase db reset` cleared auth** so you must sign in again and use the new id.

This inserts ~30+ **finished** sessions over the last ~90 days (labels `Local seed — …`) plus `set_logs`, after removing any previous `Local seed%` rows for that user. Safe to re-run.

For **local** URLs (`127.0.0.1` / `localhost`), the script always uses the [local demo service role](https://supabase.com/docs/guides/local-development/cli). **`SUPABASE_SERVICE_ROLE_KEY` in `.env` is ignored** for loopback targets so a hosted project’s key does not get sent to local Auth (which would produce `invalid JWT` / `signature is invalid`). Override for this script only with **`SUPABASE_HISTORY_SEED_SERVICE_ROLE_KEY`** (e.g. if you changed local JWT secrets — use the service role from `supabase status`).

### Row Level Security (RLS)

RLS policies apply to the **anon key + user JWT** used by the app. Studio often uses elevated access, so something can “work in Studio but fail in the app” when RLS blocks the client.

### Edge Functions (e.g. AI generation)

With `VITE_SUPABASE_URL` pointing at localhost, `supabase.functions.invoke` hits **local** functions. The Gemini key is **not** read from the Vite app’s `.env.local` — it must be available to the **Edge runtime**.

1. Copy `supabase/functions/.env.example` → `supabase/functions/.env`.
2. Set `GEMINI_API_KEY=` to a key from [Google AI Studio](https://aistudio.google.com/apikey).
3. Restart Docker so the functions container picks it up: `npm run supabase:stop` then `npm run supabase:start`.

If you see `{ "error": "GEMINI_API_KEY is not set" }` from `generate-program` / `generate-workout`, the local `.env` is missing or the stack was not restarted after adding it.

For **hosted** Supabase, set the same variable in the [Dashboard → Edge Functions → Secrets](https://supabase.com/dashboard/project/_/settings/functions) or via `supabase secrets set GEMINI_API_KEY=...` on a linked project. See [Supabase — Environment variables](https://supabase.com/docs/guides/functions/secrets).

### E2E tests

Playwright tests expect local Supabase (see `e2e/`). Start the stack before `npm run test:e2e` when tests hit the API.

### CLI vs linked remote

`supabase link` can warn that local Docker image versions differ from the linked project. Usually safe to ignore for daily dev; upgrade the CLI or re-link when you want them aligned.

---

## Project Structure

```
src/
├── components/
│   ├── ui/            # shadcn primitives (button, dialog, table, tabs, etc.)
│   ├── workout/       # DaySelector, ExerciseStrip, SetsTable, RestTimerOverlay, SessionSummary
│   ├── history/       # StatsDashboard, SessionList, ExerciseChart, ExerciseTab
│   ├── builder/       # DayList, DayEditor, ExerciseLibraryPicker, ExerciseDetailEditor
│   ├── AppShell.tsx   # Layout shell with bottom nav
│   ├── SideDrawer.tsx # Settings, theme, language, weight unit, install, sign out
│   └── SyncStatusChip.tsx
├── hooks/             # 17 hooks (useWorkoutDays, useLastSession, useBestPerformance, useWeightUnit, etc.)
├── lib/               # supabase client, syncService, epley 1RM, i18n init, formatters, query client
├── locales/           # en/ and fr/ JSON translation files (6 namespaces each)
├── pages/             # LoginPage, WorkoutPage, HistoryPage, BuilderPage
├── router/            # Routes + AuthGuard
├── store/             # Jotai atoms (session, rest, auth, sync, locale, theme, etc.)
├── types/             # TypeScript types (auth, database)
└── main.tsx
```

---

## Database

Five tables with row-level security scoped to the authenticated user:

| Table | Purpose |
|---|---|
| `exercises` | Exercise catalog (name, muscle group, emoji) |
| `workout_days` | User's training days (label, emoji, sort order) |
| `workout_exercises` | Exercises assigned to a day (sets, reps, weight, rest) |
| `sessions` | Completed workout sessions |
| `set_logs` | Individual set records (reps, weight, 1RM, PR flag) |

See `supabase/migrations/` for the full schema.

---

## Roadmap — Next Iteration

Things that would make sense to tackle next, roughly ordered by impact:

**Testing & CI**
- Broaden unit/integration coverage (edge cases, fewer mocks, visual regression optional).
- Expand Playwright coverage (AI flows, cycles, library) and keep local Supabase fixtures maintainable.

**CI/CD**
- Further harden pipeline (bundle budgets, preview deploys, scheduled E2E).

**Performance**
- Lazy-load routes (`React.lazy` + `Suspense`).
- Bundle analysis and tree-shaking audit.

**Data Export**
- CSV or JSON export of workout history from the History page.

**Richer Analytics**
- Total volume over time, muscle-group breakdown, streak tracking.

**Accessibility**
- Keyboard navigation audit, ARIA labels, screen reader testing.

**Onboarding & programs**
- Deeper coaching or analytics on top of the existing wizard (templates, blank, AI program).

**Exercise Name Translations**
- Exercise names are user-owned Supabase data and currently not translated. Could offer a translation layer or let users rename.

---

## License

MIT

---

Built by [Pierre Tsiakkaros](https://github.com/PierreTsia)
