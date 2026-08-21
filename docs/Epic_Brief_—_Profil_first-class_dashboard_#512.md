# Epic Brief — Profil first-class dashboard (#512)

## Summary

GymLogic gets a first-category **Profil** at `/profile`: a 7j / 30j / 100j / 1 an / Toujours athlete pulse that uses **Program**, **Quick Workout**, **Benchmark Circuits**, **RIR 0 rate**, **Équilibre**, and Succès — objects Hevy cannot paste. History stays the carnet. Account stays the form until a later Settings epic. Delivery is mocked architecture first (admin-only), then aggregations and wiring in parallel; the `isAdmin` guard comes off last.

**Decision record:** vision + delivery grill 21 Aug 2026. Issue [#512](https://github.com/PierreTsia/workout-app/issues/512); related fork [#502](https://github.com/PierreTsia/workout-app/issues/502). Glossary terms in `file:docs/CONTEXT.md`. Mocks: `file:docs/visions/profile-mix-stacked.canvas.tsx`, `file:docs/visions/profile-copy-deck.canvas.tsx`, `file:docs/Vision_—_Profil_dashboard.md`. Canvas is shape + copies, not a pixel spec.

---

## Context & Problem

**Who is affected:** Athletes already in GymLogic (especially power users with a **Program**, Quick Workouts, and **Benchmark Circuits**); the maintainer dogfooding behind `isAdmin` until ungate; non-admins who must not see a mocked dashboard.

**Current state:**
- `file:src/pages/AccountPage.tsx` is onboarding form + badge vitrine + PAT + delete. Drawer identity card → `/account` with a Settings icon (`file:src/components/SideDrawer.tsx`).
- Glance-at-progress lives in History: all-time counts (`file:src/components/history/StatsDashboard.tsx`), heatmap, by-exercise, Balance 30d. No empty-state contract, no period vs-prior on the identity surface.
- SSOT pieces exist and will be reused or **explicitly not reused**: `sessions.active_duration_ms`, `get_volume_by_muscle_group` + `computeBalanceScore`, `was_pr` / `file:src/lib/prDetection.ts`, `get_badge_status`, `annotateAmrapRuns` (last-8 — **wrong** for **Profil Circuit PB**).
- `#502` asked dashboard vs diagnosis vs Hevy exercise page. This epic picks **period dashboard on Profil**.
- Nearby RPCs lie under the same English labels: `get_training_activity_by_day.minutes` is wall-clock including pauses; `get_cycle_stats` PR count drops duration and is set-level; `consistency_streak` is lifetime `session_count`, not a day chain.

**Pain points:**

| Pain | Impact |
|---|---|
| Identity surface is a form | No reason to open Account between sessions |
| History is the carnet *and* the only pulse | Hevy-shaped glance; GL objects buried |
| Wiring the nearest RPC under a Profil label | Pulse minutes silently include rest (`get_training_activity_by_day`) |
| Circuit stations used to skip `prDetection` | Fixed (T226). Old rows still need the backfill before T236 |
| Last-8 `isPb` | A career Circuit PB outside the slice is invisible |

---

## User Stories

1. As an **admin**, I want **Profil** in the drawer (same rank as History) and `/profile` behind `AdminOnly` + `AdminGuard` (`file:src/components/admin/AdminOnly.tsx`, `file:src/router/AdminGuard.tsx`), so that I can dogfood the fold without exposing a mock to other users.
2. As a **non-admin**, I want no Profil nav item and `/profile` to bounce home, so that I never land on fixtures or half-wired charts.
3. As an **athlete** (post-ungate), I want `/profile` to be the pulse and Account to still hold PAT / DELETE / questionnaire, so that Settings can wait. No `/account` redirect in this epic.
4. As an **athlete**, I want a global **7j / 30j / 100j / 1 an / Toujours** toggle (day / ISO week / ISO week / month / year; same TZ as `get_training_activity_by_day`). **Toujours** has no vs-préc. deltas. So that a season and a career are both reachable without dumping all `set_logs` on first paint.
5. As an **athlete**, I want the fold in three acts — Cette fenêtre (Hero, Succès, pulse, Rythme, Mix), Preuve (Records, Équilibre), Pratique (Récurrents, Circuits) — so that Mix + Rythme sit **above** Records.
6. As an **athlete**, I want Hero: avatar, name, equipped title, active **Program**, **Profil tenure** (human duration since first finished session), and **Hero hop line** only if ≥2 distinct `program_id` produced a session **in this window**, so that **Quick Workout** does not look like a second plan. Not a **Training streak**.
7. As an **athlete**, I want Succès as Latest (career `granted_at`) + Highest (career rank) + Recently earned (`granted_at` in window) + `{n}/{total}` + **Voir tout** → `/achievements`, so that Account’s top-3-by-`tier_level` is not the model.
8. As an **athlete**, I want pulse **Séances** (delta vs prior equal window), **Session time** (`SUM(active_duration_ms)`, wall-clock fallback like `get_cycle_stats` — **never** `get_training_activity_by_day.minutes`), and **Durée moy.** vs **Prescribed session duration** with a link to the form (`/account` today), so that the vs is editable.
9. As an **athlete**, I want **Rythme** as presence (empty rings are the story; no min floor). Skip-vs-plan rings only if a single **Program** dominates the window (numeric “dominates” → Tech Plan).
10. As an **athlete**, I want **Mix** stacked 100% with **Mix slice** precedence: **Benchmark Circuit** on the workout day (`benchmark_circuit_id`) > **Quick Workout** (`program_id` null) > **Programme**. Jetable Circuits never take the Circuits slice.
11. As an **athlete**, I want **Records**: **Profil PR** count (distinct `(session_id, exercise_id)` with `was_pr`, duration included — not `get_cycle_stats`), distinct exercises, days since last, combo bars (PRs) + **RIR 0 rate** line (dual axis, no green/red). Line needs ≥2 declared-RIR buckets; no imputed drawer-default 2; no fake `0 %`.
12. As an **athlete**, I want Circuit station sets to participate in `was_pr` via the same `prDetection` as solos, so that a loaded deadlift in a Circuit can be a **Profil PR**. **T226 done** (`file:src/lib/blockSetLog.ts`). Records wiring (T229) consumes it.
13. As an **athlete**, I want **Équilibre**: score pill + band + delta vs the same-length shifted window, radar 13 `MUSCLE_TAXONOMY` groups (**sets**, not kg). Score/radar require ≥3 sessions (`hasEnoughBalanceData`). Body map and agonist pairs stay in History.
14. As an **athlete**, I want **Tonnage** in the second desktop column (mobile stacked): `weight_logged > 0` × numeric reps, Circuit loaded sets **in**, bodyweight at 0 kg and duration **out**, not the sum of radar axes. ≥1 loaded set or empty. A Cindy Friday can be Mix **Circuits** and **0 t**.
15. As an **athlete**, I want **Regulars** to follow the same window as the rest of the fold: total numeric reps per catalog `exercise_id` in that window, tie-break `max(logged_at)`, ≥2 sessions to appear, top ~8, Circuit stations count. No Program pin.
16. As an **athlete**, I want **Circuits**: catalog only, type-aware **AMRAP** and **Tours** (name + type below, small **PB** on the name), per-row **run count** + **best run in the window** (not last), sparkline last-8 (≥2 runs for a line), **Profil Circuit PB** = career-best `template_fingerprint` in this window (full ledger, not `RUN_LIMIT 8`). First complete run is not a PB. Jetable stay in History. Olympians `{n}/4` is a pill, not a fourth stat.
17. As an **athlete with not enough data**, I want per-graph empty states per **Profil not-enough-data** (not loading, not a fake series), so that a 7d radar is not a score on two sessions.
18. As an **athlete with zero sessions in the window**, I want the pulse strip empty (not “0 min vs 60 prescrits”) and Mix empty; Rythme all-empty is valid.
19. As an **athlete**, I want FR/EN copies from `file:src/locales/{en,fr}/profile.json` (HITL-validated; product names untranslated: Quick Workout, RIR, PR, PB, AMRAP). The copy-deck canvas is leftover editorial (T235).
20. As an **admin during T0**, I want every block on fixtures (Pierre data + admin empty/loading switch), so that adding a block is a thin `ProfileSection` + children, not a new page layout. Not a `<ProfileWidget<T>>` registry.
21. As an **admin**, I want chart atoms (stacked Mix, dual-axis combo, 13-axis radar) proven against `file:src/components/ui/chart.tsx` / Recharts **before** assembling the page shell, so that T0 is assembly, not a Recharts debug.
22. As a **returning athlete on RPC error**, I want the block to fail visibly, not silently reuse a wrong nearby aggregate. No new offline cache in this epic.
23. As a **maintainer**, I want aggregations testable without UI and wiring one block at a time, so that Mix SQL and Circuit PB history can land in parallel after T0.
24. As a **non-admin after ungate**, I want the `isAdmin` wrappers gone from Profil nav and route. Ungate is the **last** ticket, after all blocks are wired.
25. As a **reader of Built in public**, I want each algo to match `file:docs/CONTEXT.md` (no hidden imputations), so that a later post can quote the brief.

### Success measures

| Story # | Measure |
|---|---|
| 1–2 | Non-admin: no nav row; `/profile` → `/`. Admin: both visible |
| 11 | Fixture with a duration `was_pr` increments Records; `get_cycle_stats` PR field is not the source |
| 12 | A weighted Circuit station that beats prior solo/circuit scores sets `was_pr` |
| 13 | 2 finished sessions in 7d → radar/score empty; Tonnage may still render |
| 14 | Cindy-only day: Mix slice Circuits, Tonnage 0 t if all `weight_logged` are 0 |
| 17 | Each **Profil not-enough-data** floor has a fixture or unit test |
| 24 | No remaining `AdminOnly` / `AdminGuard` call sites whose only job is hiding Profil |

---

## Scope

**In scope:**
- Route `/profile` (flat, not `/profile/dashboard`) + drawer item; `AdminOnly` + `AdminGuard` until the last ticket
- T-1: presentational chart atoms (Mix stacked, Records combo dual-axis, Équilibre radar) on shadcn `Card` / `Skeleton` / `ToggleGroup` / `ChartContainer`
- T0: full fold on fixtures, thin `ProfileSection` (header + skeleton + empty slot), empty / loading / data per block, shared window context, admin empty/loading switch
- `was_pr` on Circuit station logs using `prDetection` (write path + Records wiring)
- Aggregations + wiring per block (parallel after T0). Forbidden bindings: pulse minutes → `get_training_activity_by_day.minutes`; Records count → `get_cycle_stats` PR field; Circuit PBs → last-8 `annotateAmrapRuns.isPb` alone
- First paint: **no one round-trip per block**. Numeric budget → Tech Plan
- Tonnage beside radar (2 equal columns desktop, stacked mobile)
- i18n FR/EN from the copy deck
- Ungate (remove Profil admin wrappers) as the last ticket
- Keep `file:docs/CONTEXT.md` aligned with shipped algos

**Out of scope:**
- History rewrite, Activity heatmap, body map on Profil, monthly sessions chart
- Public / social profile
- `/settings` and `/account` redirect (Account stays)
- HOLD honor-rate
- Mix overlay / non-exclusive stacks
- Hevy exercise-identity page (#502 remainder)
- Offline-first cache for Profil
- Pixel-perfect canvas as implementation spec

---

## Success Criteria

- **Qualitative:** An admin can open Profil, toggle 7j / 30j / 100j / 1 an / Toujours, and read the three acts with honest empties (Toujours: no vs-préc.). After ungate, a non-admin gets the same **wired** surface; Account still does PAT / delete.
- **Qualitative:** A duration PR counts on Records; a Cindy day is Mix **Circuits** and **Tonnage** 0 t; a deadlift Circuit with `weight > 0` counts in Tonnage and can mint a **Profil PR**.
- **Numeric:** Zero remaining admin wrappers whose only job is hiding Profil, on the ungate ticket.
- **Numeric:** No Profil widget issues its own identical session-list fetch (Tech Plan sets the round-trip cap).
