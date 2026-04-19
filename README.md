# GymLogic

A mobile-first PWA for tracking strength training — with offline support, progression tracking, workout analytics, and an **MCP server that lets your AI agent coach you using your real training data**.

Built with React 19, TypeScript, Supabase, and Tailwind CSS. Live at [gymlogic.me](https://gymlogic.me).

---

## Connect your AI agent

GymLogic exposes your training data as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server. This means Claude, Cursor, Le Chat, and other MCP-compatible agents can search your exercise catalog, pull your session history, analyze your training stats, and check your upcoming workouts — all through natural conversation.

**Setup guides:**

- [Cursor](docs/mcp-connect/cursor.md)
- [Le Chat (Mistral)](docs/mcp-connect/le-chat.md)
- [Claude Desktop](docs/mcp-connect/claude-desktop.md)

**Available tools:**

| Tool | What it does |
|---|---|
| `search_exercises` | Search 360+ exercises by name (FR/EN), muscle group, equipment, difficulty |
| `get_exercise_details` | Full exercise metadata: instructions, muscles, equipment, media |
| `get_workout_history` | Past sessions with sets, weights, and PR flags |
| `get_training_stats` | Volume by muscle group, personal records, session frequency |
| `get_upcoming_workouts` | Programmed training days and exercises |

Plus 1 MCP Resource (`exercise_catalog_schema`) exposing the domain taxonomy so agents understand the vocabulary without burning tool calls.

The MCP server runs as a single Supabase Edge Function with hand-rolled JSON-RPC 2.0, OAuth 2.1 for client auth, and RLS-scoped queries so each user only sees their own data.

> See the [Epic Brief](docs/Epic_Brief_—_MCP-First_Architecture_%23231.md) and [Tech Plan](docs/Tech_Plan_—_MCP-First_Architecture_%23231.md) for architecture details.

---

## Features

### Workout session
- Day selector and horizontal **exercise strip**; per-exercise **sets table** (reps, weight, done checkbox)
- **RIR (reps in reserve)** per set with **in-session load suggestions** based on previous set performance
- Full-screen **rest timer** (countdown, audio, vibration, notifications) and **session timer**; **session summary** on completion
- **Last session** reference per exercise
- **Exercise detail**: structured **instructions**, YouTube demo, illustration, **body-map** muscle highlight, and **exercise history** sheet (past sessions + trend chart)
- **Quick workout**: generate a **single ad-hoc session** with AI (constraints + Edge Function) when you want something off-program

### Programs & cycles
- **Create program** flow: pick a **template**, start **blank**, or build an **AI-generated** multi-day program (constraints wizard, preview, confirm) via Gemini
- Template path resolves **equipment swaps** using the exercise alternatives catalog
- Sessions linked to **training cycles**; **cycle summary** route surfaces completion stats and history
- Full **CRUD** for programs (workout days, slot exercises) with **drag-and-drop** reorder and **exercise library picker**

### Progression & PRs
- **Epley estimated 1RM** from logged sets; **automatic PR detection** with a **PR badge** when you beat your previous best
- `estimated_1rm`, `was_pr`, and **RIR** persisted on `set_logs` for history and suggestions

### History & analytics
- **Stats dashboard** (sessions, sets, PRs, volume) and reverse-chronological **session list** with expandable details
- Per-exercise **1RM-over-time** charts
- **Activity heatmap** and **muscle group breakdown**

### Achievements
- **Badge system** with multiple tracks (consistency, strength, volume, exploration)
- Achievement **detail drawer** with progress tracking
- **Title system** — unlock display titles based on achievements

### Exercise library
- **360+ exercise catalog** with search, **muscle group** and **equipment** filters, **difficulty** badges
- Rich metadata: FR/EN names, instructions (setup, movement, breathing, common mistakes), YouTube URLs, illustrations, secondary muscles
- **Exercise detail page** with body-map, instructions, history, and media

### Account & email
- **Account page** with avatar upload, display name, weight unit preference
- **Transactional emails** via Resend (welcome, lifecycle) with unsubscribe management
- **Custom domain** email (`admin@gymlogic.me`)

### Offline-first sync
- `SyncService` queues set logs and session finishes in **localStorage** with **fingerprint-based deduplication**
- Queue drains on reconnect and on load when authenticated
- **Sync status** chip in the UI

### PWA & shell
- Install prompt, **Workbox** service worker (app shell + runtime caching), standalone display
- **Route-level error boundaries** for failed navigations
- Bottom nav + drawer **App shell** for workout, history, builder, library, achievements

### Internationalization & theming
- **FR / EN** via react-i18next with per-feature namespaces
- **kg / lbs** display preference (storage always in kg)
- **Dark / light** theme

### Auth & admin
- **Google OAuth** via Supabase Auth; **AuthGuard** on protected routes
- **OAuth 2.1 server** for MCP client authentication with consent page
- **Admin**: exercise review, enrichment tools, feedback triage, gated by `admin_users`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build | Vite 7 |
| Language | TypeScript 5.9 |
| State | Jotai (atomWithStorage for persistence) |
| Server state | TanStack React Query 5 |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) |
| MCP server | Hand-rolled JSON-RPC 2.0 on Supabase Edge Functions |
| AI generation | Google Gemini 2.5 Flash (via Edge Functions) |
| UI components | shadcn/ui (Radix primitives) |
| Styling | Tailwind CSS 3.4 + tailwindcss-animate |
| Charts | Recharts |
| Drag & drop | dnd-kit |
| i18n | react-i18next + i18next-browser-languagedetector |
| Email | Resend (transactional) |
| Icons | lucide-react |
| PWA | vite-plugin-pwa (Workbox) |
| Theming | next-themes |
| Testing | Vitest + Testing Library + Playwright |
| CI/CD | GitHub Actions + Vercel |

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

### Environment files

| File | Who reads it | Purpose |
|------|----------------|---------|
| **`.env.local`** | Vite (`npm run dev`, `npm run build` locally) | `VITE_*` for the browser client — use for local API URL + anon key |
| **`.env`** (project root) | **Supabase CLI** when parsing `supabase/config.toml` | `env(...)` placeholders (e.g. Google OAuth for local Auth). **The CLI does not load `.env.local`.** |
| **Vercel / CI** | Production builds | Set `VITE_*` in the dashboard; nothing from `.env.local` is deployed |

### Service URLs and ports (default)

| Port | Service |
|------|---------|
| **54321** | REST / Auth / Edge Functions API (`VITE_SUPABASE_URL`) |
| **54322** | Postgres (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) |
| **54323** | [Supabase Studio](http://127.0.0.1:54323) — table editor, SQL, Auth users |
| **54324** | [Inbucket](http://127.0.0.1:54324) — captures auth emails locally |

### Google Sign-In locally

`supabase/config.toml` enables Google when the corresponding vars exist in **project-root `.env`**. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your **Web** OAuth client:

- **Authorized redirect URIs** must include: `http://127.0.0.1:54321/auth/v1/callback`
- Keep your hosted callback too if you use the same client for prod
- **Authorized JavaScript origins**: `http://localhost:5173` and `http://127.0.0.1:5173`

After changing `config.toml` or `.env` auth vars, run `npm run supabase:stop` then `npm run supabase:start`.

### Edge Functions

With `VITE_SUPABASE_URL` pointing at localhost, `supabase.functions.invoke` hits **local** functions.

| Function | Purpose |
|---|---|
| `generate-program` | AI program generation via Gemini |
| `generate-workout` | Quick workout generation via Gemini |
| `mcp` | MCP server (JSON-RPC 2.0, 5 tools + 1 resource) |
| `send-transactional-email` | Welcome and lifecycle emails via Resend |
| `email-unsubscribe` | Email preference management |
| `delete-account` | Account deletion with data cleanup |

The Gemini key must be available to the Edge runtime:

1. Copy `supabase/functions/.env.example` → `supabase/functions/.env`
2. Set `GEMINI_API_KEY=` to a key from [Google AI Studio](https://aistudio.google.com/apikey)
3. Restart: `npm run supabase:stop` then `npm run supabase:start`

For **hosted** Supabase, set secrets via `supabase secrets set GEMINI_API_KEY=...` or the dashboard.

### History seed data

```bash
npm run seed:history -- --user-id=<your-auth-uuid>
```

Inserts ~30+ finished sessions over the last ~90 days. See the script for options (`--list-users`, `--url`, etc.).

### E2E tests

Playwright tests expect local Supabase. Start the stack before `npm run test:e2e`.

---

## Project Structure

```
src/
├── components/
│   ├── ui/            # shadcn primitives
│   ├── workout/       # DaySelector, ExerciseStrip, SetsTable, RestTimerOverlay, SessionSummary
│   ├── history/       # StatsDashboard, SessionList, ActivityTab, Heatmap
│   ├── builder/       # DayList, DayEditor, ExerciseLibraryPicker
│   ├── library/       # ExerciseCatalog, AddExerciseToDaySheet
│   ├── body-map/      # BodyMap muscle highlight visualization
│   ├── achievements/  # BadgeGrid, AchievementDetailDrawer
│   └── AppShell.tsx   # Layout shell with bottom nav
├── hooks/             # useWorkoutDays, useLastSession, useBestPerformance, useWeightUnit, etc.
├── lib/               # supabase client, syncService, epley 1RM, i18n, formatters, supabase-oauth
├── locales/           # en/ and fr/ JSON translation files
├── pages/             # LoginPage, WorkoutPage, HistoryPage, BuilderPage, AchievementsPage, etc.
├── router/            # Routes + AuthGuard
├── store/             # Jotai atoms (session, rest, auth, sync, locale, theme)
├── types/             # TypeScript types (auth, database, achievements, etc.)
└── main.tsx

supabase/
├── functions/
│   ├── mcp/           # MCP server (JSON-RPC handler, tools, resources, formatters)
│   ├── generate-program/
│   ├── generate-workout/
│   ├── send-transactional-email/
│   ├── email-unsubscribe/
│   └── delete-account/
├── migrations/        # Postgres schema migrations
└── seed.sql           # Exercise catalog + seed data

docs/
├── mcp-connect/       # Per-client MCP connection guides
├── Epic_Brief_*       # Epic briefs for current work
├── Tech_Plan_*        # Technical plans
├── T*                 # Implementation tickets
└── done/              # Completed epic/ticket docs
```

---

## Database

Core tables with row-level security scoped to the authenticated user:

| Table | Purpose |
|---|---|
| `exercises` | Exercise catalog (360+ items, FR/EN names, instructions, media) |
| `programs` | User training programs |
| `cycles` | Training cycles within a program |
| `workout_days` | Training days (label, sort order) |
| `workout_exercises` | Exercises assigned to a day (sets, reps, weight, rest) |
| `sessions` | Completed workout sessions |
| `set_logs` | Individual set records (reps, weight, 1RM, PR flag, RIR) |
| `achievements` | Badge definitions and user progress |
| `admin_users` | Admin access control |
| `exercise_feedback` | User-reported content issues |
| `transactional_email_log` | Email delivery tracking |
| `email_preferences` | User email opt-in/out |

See `supabase/migrations/` for the full schema.

---

## License

MIT

---

Built by [Pierre Tsiakkaros](https://github.com/PierreTsia)
