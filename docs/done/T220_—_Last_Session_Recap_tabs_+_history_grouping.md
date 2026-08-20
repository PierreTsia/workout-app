# T220 — Last Session Recap tabs + history grouping

## Goal

Replace Home’s done-day `ExerciseListPreview` / `summarizeSessionLogs` flatten with **Last Session Recap**: tabs **Dernière séance** (default) / **Programme**, recap body grouped like History, Programme a read-only **Unified Day Sequence** without kg. Stories 1–3, 6–7, 11–16.

## Mode

AFK

## Slice

extract `SessionHistoryBody` → `ProgrammeSequenceList` → `LastSessionRecap` + WorkoutPage swap → vitest (+ e2e smoke if cheap)

## Dependencies

None (can land in parallel with T219; do not fight T219’s card badge if both touch `WorkoutDayCard` — T220 should not edit the card)

## Scope

### Extract — `file:src/components/history/SessionHistoryBody.tsx`

Move the inner `SessionSetLogs` pipeline from `file:src/components/history/SessionRow.tsx` (logs + `useSessionBlockMeta` + `useSessionBlockRuns` + `groupSessionHistory` + `BlockHistoryCard` / solo grid + metaPending guard). `SessionRow` keeps collapsible chrome and renders `<SessionHistoryBody sessionId={s.id} />`.

Existing `SessionRow` tests must still pass (names, circuit card).

### Programme list — `file:src/components/workout/ProgrammeSequenceList.tsx`

`buildDayItems(exercises, blocks)`. No swap/delete/add, no kg.

- Block: label, **AMRAP** cap + gloss (`Never shown naked`) or **Tours** round count, station names (emoji + name).
- Solo: emoji + `exerciseName`, template `sets × reps` or duration, no weight, no `ExerciseEditRowControls`.

Tests: 4 AMRAP blocks → 4 cards, no `kg`; one solo 4×8 @ 50 → no `50`.

### Recap shell — `file:src/components/workout/LastSessionRecap.tsx`

Props: `lastSession` (`useLastSessionForDay` result), live `exercises` + `blocks`.

- `useSessionSetLogs(lastSession?.id)`: wait until `isSuccess` / settled.
- No logs (or no last session): **no Tabs**; render `ProgrammeSequenceList` only.
- Logs present: shadcn `Tabs`, `defaultValue="last-session"`, full-width triggers like `ExerciseSwapInlinePanel`.
  - Last session: `formatRelativeDate` + `formatSessionDurationForDisplay`; `SessionHistoryBody`; **no** coverage line yet (T221).
  - Programme: `ProgrammeSequenceList`.
- Do not persist tab in localStorage.

### WorkoutPage — `file:src/pages/WorkoutPage.tsx`

- Delete `previewItems`, `ExerciseListPreview`, `summarizeSessionLogs`, `templateToPreviewItems` usage.
- `isDayDoneInCycle` → `<LastSessionRecap lastSession={…} exercises={…} blocks={dayBlocks} />`.
- Keep `useLastSessionForDay` gated on `isDayDoneInCycle`.
- `!isDayDoneInCycle` unchanged (`PreSessionExerciseList` + Start).
- Restart footer unchanged.

If `sessionSummary.ts` helpers have no remaining production callers, delete them **and** `ExerciseListPreview.tsx` (update/remove their tests). Do not leave dead Home preview code.

### i18n

`recap.tabLastSession` / `recap.tabProgram` (EN Last session / Program, FR Dernière séance / Programme).

### Tests

- `LastSessionRecap.test.tsx`: with logs, default tab is Last session (Theseus-style **AMRAP** score visible, not `5 × 0–10`); Programme tab shows 4 Circuit labels; empty logs → no tablist, programme list still there.
- `vi.mock("@/lib/supabase")`. Mock the recap hooks.
- Do not require a full `WorkoutPage` mount if recap tests cover the branch; a thin WorkoutPage test that `ExerciseListPreview` is not in the tree on done-day is enough if feasible.

E2E: extend `file:e2e/cycle-abandon.spec.ts` if the fixture can assert tab names without a full Circuit seed; otherwise unit coverage is the gate and T221/T222 can deepen e2e.

## Out of Scope

- Coverage fact line (T221)
- Hero badge (T219)
- `update_program` CASCADE fix
- `readOnly` flag on `PreSessionExerciseList`

## Acceptance Criteria

- [ ] Done-day Home does not import `ExerciseListPreview` or `summarizeSessionLogs`
- [ ] With Circuit `set_logs` + **Block Run**, recap shows `BlockHistoryCard` / **AMRAP** `4+0` (or equivalent score), not `5 × 0–10`
- [ ] Tabs default to Last session; Programme is one tap
- [ ] Empty `set_logs`: no tablist; programme sequence still visible
- [ ] Undone day: Start + editable list, no recap tabs
- [ ] Restart-cycle CTA still shown when `canOfferCycleRestart`
- [ ] `SessionRow` still groups circuits in History
- [ ] `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run` for touched tests

## References

- Epic Brief #498 stories 1–3, 6–7, 11–16
- Tech Plan: LastSessionRecap, SessionHistoryBody, ProgrammeSequenceList
