# Workout App

A mobile-first PWA for tracking strength training sessions — with offline support, progression tracking, and workout analytics.

Built with React 19, TypeScript, Supabase, and Tailwind CSS.

---

## Features

### Workout Session
- Pick a training day, swipe through exercises via the exercise strip
- Inline sets table with editable reps and weight per set
- Full-screen rest timer overlay with countdown, audio alert, vibration, and push notifications
- "Last session" reference shown per exercise so you know what you did last time
- Session timer tracks total elapsed time; session summary at the end

### Progression Tracking
- Automatic PR detection using the Epley 1RM formula
- PR badge displayed on the exercise strip when a new personal record is hit
- `was_pr` flag persisted in set logs for historical reference

### History & Analytics
- Stats dashboard: total sessions, total sets, PR count
- Reverse-chronological session list with expandable set details
- Per-exercise line charts (Recharts) showing estimated 1RM over time

### Workout Builder
- Full CRUD for training days and exercises
- Exercise library picker with search (cmdk)
- Drag-and-drop reorder via dnd-kit
- Online-only — shows an offline block state when disconnected

### Offline-First Sync
- `SyncService` queues set logs and session finishes in localStorage
- Fingerprint-based deduplication prevents duplicate rows
- Auto-drains on `online` event and on app load
- Sync status chip in the UI

### PWA
- Installable on mobile and desktop via `beforeinstallprompt`
- Service worker powered by Workbox (app shell cache + NetworkFirst for Supabase API)
- Standalone display mode

### Internationalization
- FR / EN via react-i18next with 6 namespaces (`common`, `auth`, `workout`, `history`, `builder`, `settings`)
- kg / lbs weight unit toggle — display-only preference, storage is always in kg
- Locale-aware date and number formatting via `Intl`

### Auth & Theming
- Google OAuth via Supabase Auth, with AuthGuard on protected routes
- Notification permission prompt on first sign-in
- Dark / light mode toggle via next-themes

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

Fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

### Supabase (optional local setup)

```bash
supabase start
supabase db reset   # runs migrations + seed
```

Migrations live in `supabase/migrations/`. Seed data (24 exercises) is in `supabase/seed.sql`.

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
├── hooks/             # 16 hooks (useWorkoutDays, useLastSession, useBest1RM, useWeightUnit, etc.)
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

**Testing**
- No tests exist today. Vitest + React Testing Library for unit/integration coverage on `SyncService`, hooks, and key components.
- Playwright for E2E on critical flows (login, full workout session, builder CRUD).

**CI/CD**
- GitHub Actions pipeline: lint, type-check, build, deploy.

**Performance**
- Lazy-load routes (`React.lazy` + `Suspense`).
- Bundle analysis and tree-shaking audit.

**Data Export**
- CSV or JSON export of workout history from the History page.

**Richer Analytics**
- Total volume over time, muscle-group breakdown, streak tracking.

**Accessibility**
- Keyboard navigation audit, ARIA labels, screen reader testing.

**Onboarding**
- Guided first-use flow beyond the auto-bootstrap Push/Pull/Legs program.

**Exercise Name Translations**
- Exercise names are user-owned Supabase data and currently not translated. Could offer a translation layer or let users rename.

---

## License

MIT

---

Built by [Pierre Tsiakkaros](https://github.com/PierreTsia)
