# Workout App — Product Requirements Document

## Overview

**Workout App** is a mobile-first PWA for tracking strength training sessions with integrated rest timers, exercise progression, workout analytics, and a 600+ exercise library with content (instructions, demos, illustrations).

**Target User:** Pierre Tsiakkaros (45yo, 72kg, strength training enthusiast)
**Use Case:** Neoness gym member, 6 days/week training (push/pull/legs/full-body split)
**Live at:** Vercel (CI/CD via GitHub Actions)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7 |
| Styling | Tailwind CSS 3.4, shadcn/ui (Radix primitives), class-variance-authority |
| State | Jotai (atoms) + TanStack React Query |
| Forms | React Hook Form + Zod |
| Routing | React Router DOM 7 |
| Backend | Supabase (Postgres 15, Auth, Storage, RLS) |
| i18n | react-i18next (FR/EN), 6 namespaces |
| Theming | next-themes (dark/light, class strategy) |
| Charts | Recharts |
| DnD | @dnd-kit |
| PWA | vite-plugin-pwa (Workbox, auto-update) |
| Testing | Vitest + Testing Library + Playwright |
| CI/CD | GitHub Actions → Vercel |

---

## Features (Shipped)

### Workout Session
- Day selector with horizontal exercise strip
- Sets table: reps, weight, done checkbox per set
- Auto-triggering rest timer with countdown, audio/vibration notification, skip
- Session summary on completion (duration, sets, exercises)
- Offline set logging with auto-sync on reconnect (localStorage queue, fingerprint dedupe)

### Progression & Analytics
- "Last session" reference per exercise
- PR detection using Epley 1RM (`weight × (1 + reps/30)`)
- Stats dashboard with session history and per-exercise progression charts (Recharts)
- `estimated_1rm` and `was_pr` tracked in set_logs

### Workout Builder
- Full CRUD for workout days and exercises
- Exercise library picker with free-text search, muscle group filter (single-select), equipment filter (multi-select)
- Drag-and-drop exercise reordering (@dnd-kit)
- Snapshot fields preserve exercise metadata at build time

### Exercise Library
- ~600 exercises with French names, English names, muscle group, equipment, instructions (JSONB), YouTube URLs, illustrations
- Imported from Wger API with AI-assisted French translation
- Enrichment pipeline (3 phases): YouTube → illustrations → instructions
- 23 hand-curated exercises preserved with merge/dedupe strategy

### Exercise Content
- Instructions panel (setup, movement, breathing, common mistakes) in workout view and builder
- YouTube demo links with lazy-loaded thumbnails
- Exercise illustrations (AI-generated or royalty-free)
- Content feedback system (users report errors from 3 entry points)

### PWA & UX
- Installable to home screen with install prompt banner
- Service worker with Workbox (Supabase API runtime caching)
- Dark/light theme toggle
- FR/EN language switching with weight unit preference (kg/lbs, stored kg-only)

### Auth & Admin
- Supabase Auth (Google OAuth only)
- Admin panel for exercise review (`/admin/exercises`)
- RLS on all tables
- `admin_users` table for role gating

### Quality
- Vitest unit tests (Epley, weight units, SyncService, best 1RM)
- Playwright E2E (login, workout session, builder CRUD)
- GitHub Actions CI: lint → type-check → unit tests → E2E (local Supabase) → deploy

---

## App Routes

| Path | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/about` | About | Public |
| `/` | Workout Session | Auth |
| `/history` | History & Analytics | Auth |
| `/builder` | Workout Builder | Auth |
| `/admin/exercises` | Exercise Admin | Admin |
| `/admin/exercises/:id` | Exercise Edit | Admin |

---

## Data Model (Supabase)

Core tables: `exercises`, `workout_days`, `workout_exercises`, `sessions`, `set_logs`, `exercise_content_feedback`, `admin_users`.

### exercises

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL, UNIQUE, French |
| name_en | text | English name for search |
| muscle_group | text | NOT NULL |
| equipment | text | NOT NULL, default 'bodyweight' |
| difficulty_level | text | beginner / intermediate / advanced, nullable |
| emoji | text | NOT NULL |
| is_system | boolean | NOT NULL, default false |
| youtube_url | text | Demo video |
| instructions | jsonb | { setup, movement, breathing, common_mistakes } |
| image_url | text | Illustration |
| source | text | Provenance (e.g. "wger", "manual") |
| secondary_muscles | text[] | |
| reviewed_at | timestamptz | Admin review timestamp |
| reviewed_by | text | Admin reviewer |
| created_at | timestamptz | NOT NULL, default now() |

---

## Difficulty / Experience Tiers

Shared vocabulary used across exercise classification, onboarding user profiles, and program generation. The same three tiers apply to both exercises and users.

| Tier | User Experience | Exercise Characteristics |
|---|---|---|
| **Beginner** | < 6 months regular strength training | Easy to learn, low strength/mobility demands, safe even with imperfect form |
| **Intermediate** | 6 months – 2 years | Moderate form complexity, solid strength base needed, some mobility demands |
| **Advanced** | 2+ years consistent training | High form complexity, significant strength and mobility requirements, injury risk if form breaks down |

---

## Roadmap

### Shipped
- [x] Workout session with rest timer
- [x] Supabase backend with RLS
- [x] Offline queue & sync
- [x] Progression tracking & PR detection
- [x] History & analytics dashboard
- [x] Workout builder with full CRUD
- [x] PWA (installable, service worker, theme toggle)
- [x] i18n (FR/EN) + weight unit preference
- [x] Exercise library (600+ exercises, search, filters)
- [x] Exercise content enrichment (YouTube, illustrations, instructions)
- [x] Content feedback system
- [x] CI/CD pipeline (lint, tests, E2E, deploy)
- [x] Admin panel for exercise review
- [x] About page

### In Progress
- [ ] Exercise difficulty levels (classification, badges, filter)

### Planned
- [ ] Onboarding wizard & program generation (user profiles, templates, recommendation engine)
- [ ] Gamification system (details TBD)

### Future
- [ ] Multi-user support (share programs)
- [ ] AI-powered rep suggestions
- [ ] Wearable integration
- [ ] Social features (PR celebrations, leaderboards)

---

## Design

**Style:**
- Dark theme default (#0f0f13 bg, teal accents #00c9b1), light theme available
- Mobile-first responsive layout (400px–480px primary target)
- shadcn/ui component library on Radix primitives
- Minimalist UI — focus on what matters during workout

**Key Patterns:**
- Bottom sheets for modals (exercise picker, feedback)
- Collapsible panels (filters, instructions)
- Horizontal scroll strips (exercise thumbnails, filter pills)
- Color-coded badges for metadata (PRs, difficulty)
- Toast notifications (sonner)

---

## Browser Support

- Modern browsers (Chrome, Safari, Firefox, Edge)
- iOS 15+, Android 10+
- Mobile-first design, responsive up to desktop
- PWA installable on all platforms

---

## Privacy & Security

- Supabase Auth with Google OAuth
- Row-Level Security on all tables
- No third-party analytics (planned: generic analytics_events table)
- Exercise data is server-side; session state cached locally for offline
- Admin role gated via `admin_users` table

---

## Success Metrics

- Session completion rate
- Time to find and add an exercise (search + filter UX)
- Enrichment coverage (% of exercises with instructions, YouTube, images)
- Onboarding completion rate (future)

---

## Author

Designed for **Pierre Tsiakkaros** (Jan 2026)
