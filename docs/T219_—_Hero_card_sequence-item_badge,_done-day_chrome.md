# T219 — Hero card: sequence-item badge, done-day chrome

## Goal

The carousel hero counts **Unified Day Sequence** items (1 per solo + 1 per **Exercise Block**) on every day, and a done-in-**Cycle** card no longer shows last-session date / sets / duration. Stories 4–5.

## Mode

AFK

## Slice

`sequenceItemBadge` lib → `WorkoutDayCard` + i18n → vitest

## Dependencies

None

## Scope

### Pure helper — `file:src/lib/sequenceItemBadge.ts`

| Export | Contract |
|---|---|
| `sequenceItemBadge(soloCount, blockCount)` | `{ kind: "empty" \| "solos" \| "circuits" \| "mixed", solos, circuits }` — `circuits === blockCount`, `solos === soloCount` |

4 Circuits × 3 stations → `kind: "circuits", circuits: 4`. Six solos → `kind: "solos", solos: 6`. 2 blocks + 3 solos → `mixed`.

Tests: `file:src/lib/sequenceItemBadge.test.ts`. `vi.mock("@/lib/supabase")` not needed (pure).

### Card — `file:src/components/workout/WorkoutDayCard.tsx`

- Replace `totalExerciseCount` (flatten) with `sequenceItemBadge(exercises.length, blocks.length)`.
- Badge copy from `sequenceBadgeCircuits_*` / `exerciseCount_*` / `sequenceBadgeMixed`.
- When `isCycleDone`: keep `CheckCircle2`. Remove `lastSession` date badge, `setCount`, and duration badges.
- When `!isCycleDone`: keep estimated sets; keep muted last-session date and estimated duration if a prior session exists.

### i18n — `file:src/locales/en/workout.json`, `file:src/locales/fr/workout.json`

Keys per Tech Plan i18n table (`sequenceBadgeCircuits_*`, `sequenceBadgeMixed`). Reuse `exerciseCount_*` for solos-only.

### Tests

Add a real `WorkoutDayCard` component test (today `WorkoutDayCard.test.ts` only hits formatters). Mock `useWorkoutExercises` / `useExerciseBlocks` / `useLastSessionForDay` / `useAggregatedMuscles` or pass fixtures — follow existing hook-mock style. Cases: 4 empty-exercise blocks → “4 Circuits”; done card has no “11 min” / set count; undone card still shows estimated sets.

`vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))`.

## Out of Scope

- Tabs / recap (T220)
- Fact line (T221)
- Changing `estimatedTotalSets` AMRAP math (known wart, not #498)

## Acceptance Criteria

- [ ] `sequenceItemBadge(0, 4).kind === "circuits"` and `.circuits === 4`
- [ ] Done-day card for a 4-Circuit day shows a Circuits badge, not `12 exercices`
- [ ] Done-day card does not render last-session duration or `total_sets_done`
- [ ] Undone-day card still shows estimated sets
- [ ] FR/EN keys exist; `npx tsc -p tsconfig.app.json --noEmit` clean for touched files

## References

- `file:docs/Epic_Brief_—_Completed-day_Home_Last_Session_Recap_#498.md` stories 4–5
- `file:docs/Tech_Plan_—_Completed-day_Home_Last_Session_Recap_#498.md` WorkoutDayCard / sequenceItemBadge
