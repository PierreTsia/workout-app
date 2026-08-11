# T181 — Prime Mover captures + asset swap

## Goal

Replace Tour placeholders with real EN dark-mode UI captures from the **Prime Mover** demo account (kg). Source of truth for scene count is `file:web/src/lib/tourScenes.ts`: **6 scenes × 3 shots = 18**. Addresses Epic stories 5 (visual truth), 13.

## Dependencies

T178 (placeholders exist to replace). Can parallel T179/T180.

## Scope

### Account (hosted / prod)

| Item | Value |
|---|---|
| Display name | **Prime Mover** |
| Auth user id | `afce3616-7d7a-4851-9ed4-09f2c0ec4323` |
| Email | `primemover@example.com` |
| Locale / units / theme | EN / kg / dark |
| Persona | **Echo** — intermediate ~3×/week strength; invented-but-plausible numbers |
| Program | `Echo Strength — 3×` (Push / Pull / Legs) |
| Seed target | **Hosted** Supabase (`*.supabase.co`) — local catalog is too thin for Tour shots |

App login UI is **Google-only**. Captures must use Playwright-style **session injection** (`signInWithPassword` + `localStorage`), not Google OAuth.

### Shots (18) — match `tourScenes`

| ID | File | Device | Route / UI state | Must be visible | Suggested `focal` |
|---|---|---|---|---|---|
| 01a | `01a-agent-intake.png` | Phone | AI program chat intake (`/create-program` Embedded Agent) | Multi-turn chat gathering goals before draft | `50% 45%` |
| 01b | `01b-qw-constraints.png` | Phone | Quick Workout demand / constraints sheet | Duration · equipment · focus chips + AI preferences | `50% 42%` |
| 01c | `01c-program-agent.png` | Phone | Quick Workout preview + Coach's take | Preview + Start / Save after generate | `50% 38%` |
| 01a′ | `01a-program-draft.png` (draft in `playwright/.auth/tour-captures/`) | Phone | AI program draft preview | Draft days + regenerate / keep chatting | — |
| 02a | `02a-train-sets.png` | Phone | Push → **OHP** mid-sets | Mid-workout sets + Weight-up | `50% 35%` |
| 02b | `02b-train-rir.png` | Phone | Same OHP slot | RIR control / confirm | `70% 40%` |
| 02c | `02c-train-rest.png` | Phone | Same OHP slot → rest drawer open | REST countdown ring + Pause / Skip | `50% 58%` |
| 03a | `03a-progress-suggest.png` | Phone | Start **Push** → **OHP** (not bench) | Add-weight progression pill | `70% 40%` |
| 03b | `03b-progress-hold.png` | Phone | Start **Pull** day | Hold / hold–near-failure pill | `50% 35%` |
| 03c | `03c-progress-plateau.png` | Phone | Start **Legs** day | Plateau flag (squat capped) | `50% 30%` |
| 05a | `05a-agent-chat.png` | Desktop | Claude desktop (BYOA) | Agent reads history — balance viz (volume by muscle, push/pull/legs) | `50% 45%` |
| 05b | `05b-agent-tools.png` | Desktop | Claude desktop (BYOA) | MCP permission modal — Create or replace active program (GymLogic) | `50% 50%` |
| 05c | `05c-agent-result.png` | Desktop | Claude desktop (BYOA) | Program preview after write — Jour A / B / C + rationale | `50% 42%` |
| 06a | `06a-movement-list.png` | Phone | `/library/exercises` search `press` + Filters + Shoulders | Search + filter chips + results | `50% 22%` |
| 06b | `06b-movement-detail.png` | Phone | Exercise detail (e.g. Bench Press) | Instructions + body map | `50% 30%` |
| 06c | `06c-movement-video.png` | Phone | Same detail, video in view | Demo video | `50% 35%` |
| 07a | `07a-history-heatmap.png` | Phone | `/history` → Activity → open **100-day overview** | Uneven intermediate heatmap (not cron stripes) | `50% 48%` |
| 07a′ | `07a-history-exercise-chart.png` (draft) | Phone | By Exercise → OHP | Per-exercise progress chart | — |
| 07b | `07b-history-balance.png` | Phone | `/history` → Balance | Strength Balance gauge / body map | `50% 30%` |
| 07b′ | `07b-history-balance-detail.png` (draft) | Phone | Balance scrolled | Body map + Insights | — |
| 07c | `07c-history-achievements.png` | Phone | `/achievements` → unlocked tier drawer | Tracks + unlocked step detail (Equip title) | `50% 55%` |

Filenames keep legacy numbering (`05*` = Tour scene 4 BYOA; `06*`/`07*` = scenes 5–6). Replace **in place**; do not renumber blindly.

### Swap

- Replace files under `web/src/assets/screenshots/tour/`
- Light crop/grade OK — **real app UI only**, no AI-generated fake screens
- Phone vs desktop chrome already comes from `DeviceFrame` — capture **content**, not fake bezels (except agent desktop shots where the client window is the content)

## Out of Scope

- FR captures
- Gen-AI video (Kling/etc.)
- Changing banked Tour copy (unless an alt is wrong)
- Claiming visual closeout without HITL framing approval (**T182**)

## Acceptance Criteria

- [x] Idempotent Prime Mover seed runs against hosted Supabase (`npm run seed:prime-mover`)
- [x] All **18** Tour assets are real product UI (not placeholders) — scene 1 triad: chat intake → QW constraints → QW preview (`01a`/`01b`/`01c`; program draft kept as capture draft `01a′`)
- [x] Locale EN, dark mode, kg visible where relevant (on swapped shots)
- [x] Scene 4 (files `05a`/`05b`/`05c`) is real Claude desktop BYOA chrome — read balance → MCP permission → program preview
- [x] Scene 2 triad is sets / RIR / rest (`02a`–`02c-train-rest`; last-performance line stays visible on `02a`; rest promoted from draft `02-rest-timer.png`)
- [x] Scene 6 (`07a`) heatmap is the primary history visual (swapped)
- [ ] `/tour` build + visual spot-check on desktop and mobile
- [ ] Framing approved (HITL) — otherwise leave T182 open

## Restage runbook

### 1. Seed (hosted)

```bash
# Requires VITE_SUPABASE_URL (or SEED_SUPABASE_URL) → *.supabase.co
# and SUPABASE_SERVICE_ROLE_KEY (never commit).
npm run seed:prime-mover
# optional: --user-id=<uuid>  --dry-run  --allow-local
```

Idempotent: clears `Prime Mover%` sessions + `Echo Strength — 3×` program for that user, upserts profile (EN, display name **Prime Mover**), recreates PPL + ~14 weeks of slot-scoped set logs (RIR + progression staging on the latest week). Older weeks use a **jittered calendar** (skipped sessions, Tue/Thu shifts, weekend make-ups) and uneven durations so the 100-day heatmap doesn’t look like a cron job.

### 2. Capture auth (Playwright injection)

UI cannot Google-login as this user. Use password auth against the hosted project:

```bash
# Never commit these. Local shell / CI secrets only.
export PRIME_MOVER_EMAIL=primemover@example.com
export PRIME_MOVER_PASSWORD='…'   # Dashboard password for that user
export VITE_SUPABASE_URL=https://….supabase.co
export VITE_SUPABASE_ANON_KEY=…   # publishable anon key
```

Helper (writes gitignored storage state + optional screenshots):

```bash
# App must use hosted Supabase. Plain `npm run dev` often follows `.env.local` → loopback
# and ignores the Prime Mover token (you land on the login / GET STARTED screen).
npm run dev:hosted
# If Vite says “Port 5173 is in use” → use the printed Local URL (e.g. :5174).
# Kill the stale process on :5173, or pin the capture origin:

PRIME_MOVER_PASSWORD='…' npx tsx scripts/capture-tour-auth.ts
CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-screens.ts
# In-session (sets / RIR / rest drawer) → 02a–c drafts (+ optional 02c-train-last bank):
CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-session.ts
# Catalog detail + video (Bench Press) → 06a–c drafts:
CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-movement.ts
# Quick Workout constraints (Tour 01b) + preview/Coach take (Tour 01c):
CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-quick-workout.ts
# AI program chat intake (Tour 01a) + draft preview (capture draft 01a′):
CAPTURE_APP_ORIGIN=http://localhost:5174 npx tsx scripts/capture-tour-program-ai.ts
```

Storage state must include:

- `sb-<project-ref>-auth-token` session payload from `signInWithPassword`
- `locale` → `"en"`
- `weightUnit` → `"kg"`
- `workout-app-theme` → `"dark"`

### 3. Capture pass

- Phone profile: `CAPTURE_PHONE` in `scripts/capture-tour-shared.ts` — **390×844 @ 3×** (full iPhone 14 logical height). Do **not** use stock Playwright `devices['iPhone 14']` alone (390×664 here) — it undershoots Tour `DeviceFrame` `aspect-[9/19.5]` and looks zoomed with bottom void. Desktop: `CAPTURE_DESKTOP` 1280×800 for scene 4.
- Stage interactive states (RIR drawer, progression pills, AI draft / QW) as needed — mock Edge LLM routes like e2e specs when determinism matters
- Swap files under `web/src/assets/screenshots/tour/`
- Spot-check `web/` → `/tour` on desktop + mobile
- Stop before claiming visual closeout without framing approval (T182)

### 4. Next time

1. `npm run seed:prime-mover` on hosted  
2. Re-inject session + prefs  
3. Re-run capture helper / manual shots  
4. Replace assets in place  

## References

- `file:web/src/lib/tourScenes.ts` (catalog)
- `file:scripts/seed-prime-mover.ts` / `file:scripts/prime-mover-plan.ts`
- Tech Plan Capture pipeline
- Epic Brief demo identity + proof shots
- GitHub [#466](https://github.com/PierreTsia/workout-app/issues/466)
