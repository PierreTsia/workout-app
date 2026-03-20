# T39 — Cycle Summary Page, Integration & Cleanup

## Goal

Deliver the full user-facing cycle completion summary: a dedicated page at `/cycle-summary/:cycleId` with aggregate stats and comparison deltas, wired into the session finish flow. Delete the now-redundant `CycleCompleteBanner` and add all i18n keys. After this ticket, completing a cycle takes users through a rich summary screen instead of a one-line banner.

## Dependencies

- **T38** — `get_cycle_stats` RPC, `useCycleStats`, `usePreviousCycle`, `useFinishCycle` hooks, `CycleStats` type

## Scope

### New page — `CycleSummaryPage`

New file: `src/pages/CycleSummaryPage.tsx`

- Reads `cycleId` from `useParams()`
- Fetches cycle metadata via `supabase.from("cycles").select("*").eq("id", cycleId).single()` to get `program_id`
- Calls `usePreviousCycle(programId, cycleId)` for comparison target
- Calls `useCycleStats(cycleId, previousCycleId)` for all stats
- Gets `totalDays` from `useWorkoutDays(programId)` (already cached from WorkoutPage)

Layout:
- **Hero**: Trophy icon, "Cycle Complete!" heading, date range subtitle (from `started_at` to `last_finished_at`)
- **Stats grid**: 2-column grid of `StatCard` components:
  - Sessions: `session_count / totalDays` (totalDays from client)
  - Duration: formatted `total_duration_ms`
  - Sets: `total_sets`
  - Volume: `total_volume_kg` formatted with unit
  - PRs: `pr_count`
  - Consistency: `duration_days` + "days" label
- **Comparison callout**: "vs. previous cycle" when deltas available, "First cycle — great start!" when not
- **CTAs**:
  - "Start new cycle" (primary) → `useFinishCycle().mutate(cycleId)` then `navigate("/")`
  - "Back to workouts" (secondary) → `navigate("/")` without finalizing

States:
- **Loading**: skeleton grid matching stat card layout
- **Error / not found**: "Cycle not found" message + "Back to workouts" link
- **Zero sessions**: all stats render as 0 — no special empty state needed

### New components — `StatCard` & `DeltaBadge`

New files: `src/components/cycle-summary/StatCard.tsx`, `src/components/cycle-summary/DeltaBadge.tsx`

**`StatCard`** — Props: `icon: LucideIcon`, `value: string | number`, `label: string`, `delta?: number | null`
- Renders icon, large bold value, muted label, optional `DeltaBadge`
- Uses shadcn `Card` base styling

**`DeltaBadge`** — Props: `value: number`
- `> 0`: green text, ↑ arrow, `+X%`
- `< 0`: red text, ↓ arrow, `X%`
- `0` or `null`: not rendered

### Router update

Modify `file:src/router/index.tsx`:
- Import `CycleSummaryPage`
- Add route `{ path: "/cycle-summary/:cycleId", element: <CycleSummaryPage /> }` under `AppShell` children (alongside `/`, `/history`, etc.)

### AppShell — hide session timer chip

Modify `file:src/components/AppShell.tsx`:
- Use `useLocation()` to check if pathname starts with `/cycle-summary`
- Conditionally hide `SessionTimerChip` on that route

### SessionSummary integration

Modify `file:src/components/workout/SessionSummary.tsx`:
- Add props: `cycleComplete?: boolean`, `cycleId?: string | null`
- When `cycleComplete` is true:
  - Show a "Cycle complete!" badge above the "Session Complete!" heading
  - Change CTA button text to "View Cycle Summary" (i18n key: `cycleSummary.viewSummary`)
  - `onNewSession` still triggers, but parent handles navigation

### WorkoutPage changes

Modify `file:src/pages/WorkoutPage.tsx`:
- Remove `CycleCompleteBanner` import and usage
- Pass `cycleComplete={cycleProgress.isComplete}` and `cycleId={session.cycleId}` to `SessionSummary`
- Modify `handleNewSession`: when cycle is complete and `cycleId` is available, navigate to `/cycle-summary/${cycleId}` after resetting session state
- Remove the `cycleProgress.isComplete ? <CycleCompleteBanner ... />` conditional in the pre-session layout

### Delete `CycleCompleteBanner`

Delete `file:src/components/workout/CycleCompleteBanner.tsx`. Remove all imports referencing it.

### i18n keys

Add to `file:src/locales/en/workout.json` and `file:src/locales/fr/workout.json`:

| Key | EN | FR |
|---|---|---|
| `cycleSummary.title` | Cycle Complete! | Cycle terminé ! |
| `cycleSummary.subtitle` | Here's how you did | Voici votre bilan |
| `cycleSummary.sessions` | Sessions | Séances |
| `cycleSummary.duration` | Total time | Temps total |
| `cycleSummary.sets` | Sets done | Séries faites |
| `cycleSummary.volume` | Volume lifted | Volume soulevé |
| `cycleSummary.prs` | Personal records | Records personnels |
| `cycleSummary.consistency` | Completed in | Complété en |
| `cycleSummary.days` | days | jours |
| `cycleSummary.firstCycle` | First cycle — great start! | Premier cycle — bon début ! |
| `cycleSummary.vsPrevious` | vs. previous cycle | vs. cycle précédent |
| `cycleSummary.startNewCycle` | Start new cycle | Nouveau cycle |
| `cycleSummary.backToWorkouts` | Back to workouts | Retour aux entraînements |
| `cycleSummary.cycleCompleteBadge` | Cycle complete! | Cycle terminé ! |
| `cycleSummary.viewSummary` | View Cycle Summary | Voir le bilan du cycle |
| `cycleSummary.notFound` | Cycle not found | Cycle introuvable |
| `cycleSummary.errorLoading` | Could not load stats | Impossible de charger les stats |

## Out of Scope

- Animated confetti or celebration effects (fast follow-up)
- Cycle history list page (viewing past summaries from `/history`)
- Exercise-level breakdown within the summary
- Calorie estimation
- Social sharing

## Acceptance Criteria

- [ ] `/cycle-summary/:cycleId` route renders the summary page with all 7 stats
- [ ] Stats match the RPC output (sessions, duration, sets, volume, PRs, date range, consistency)
- [ ] Comparison deltas (volume, sets, PRs) show with correct ↑/↓ badges when a previous cycle exists
- [ ] "First cycle" state renders cleanly when no previous cycle exists (no broken delta badges)
- [ ] Direct URL access works: refreshing `/cycle-summary/:cycleId` loads the page without errors
- [ ] Bogus `cycleId` in URL shows "Cycle not found" with "Back to workouts" link
- [ ] `SessionSummary` shows "Cycle complete!" badge and "View Cycle Summary" CTA after finishing the last session in a cycle
- [ ] Tapping "View Cycle Summary" navigates to `/cycle-summary/:cycleId`
- [ ] "Start new cycle" on summary page finalizes the cycle and navigates to `/`
- [ ] "Back to workouts" navigates to `/` without finalizing the cycle
- [ ] `CycleCompleteBanner` is deleted — no references remain in the codebase
- [ ] `SessionTimerChip` is hidden on the summary page
- [ ] All i18n keys present in both EN and FR
- [ ] On 390px viewport, stat cards are readable without overflow
- [ ] Build passes (`npm run build`)

## References

- [Epic Brief — Cycle Completion Summary](docs/Epic_Brief_—_Cycle_Completion_Summary.md)
- [Tech Plan — Cycle Completion Summary](docs/Tech_Plan_—_Cycle_Completion_Summary.md) → Component Architecture, SessionSummary Integration, Navigation Flow, i18n Keys, Failure Mode Analysis
