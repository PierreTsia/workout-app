# T295 — Retirer la section déviations du récap de fin

## Goal

Remove the **Ajustements** section from the end-of-session recap so the finish screen is
centred on the session summary (exercises/sets, duration, PRs) and the optional session
note. Delete the now-dead UI and its wiring; leave capture, persistence, and the
in-session reason prompt untouched.

User stories: **1, 2, 3, 4, 5, 6, 7** of the Epic Brief.

## Mode

AFK.

## Slice

`SessionSummary` (prop + render) → `WorkoutPage` (query + memo + prop) → delete
`SessionAdjustments` + `useSessionDeviations` → i18n cleanup → `docs/CONTEXT.md` →
vitest.

## Dependencies

None.

## Scope

### Remove the recap section

- Delete `file:src/components/workout/SessionAdjustments.tsx` and
  `file:src/components/workout/SessionAdjustments.test.tsx`.
- `file:src/components/workout/SessionSummary.tsx`: drop the `adjustments` prop, the
  `SessionAdjustments` / `DebriefAdjustment` import, and the render line. Keep
  `onSaveNote` + `SessionNote`.

### Remove the wiring

- `file:src/pages/WorkoutPage.tsx`: drop the `useSessionDeviations` import, the
  `buildAdjustment` / `DebriefAdjustment` import, the `finishedRealId` / `dbAdjustments`
  / `adjustments` memo, the `adjustments={adjustments}` prop, and the now-unused
  `queuedDeviationsForSession` import. Keep `onSaveNote`.
- Delete `file:src/hooks/useSessionDeviations.ts` (only `WorkoutPage` imports it).

### i18n

- Remove `deviation.debriefTitle` and `deviation.debriefEmpty` from
  `file:src/locales/{en,fr}/workout.json`. Keep every other `deviation.*` key.

### Domain doc

- Update the **Deviation** entry in `file:docs/CONTEXT.md`: the finish recap no longer
  surfaces deviations; the data is kept for the observatory.

## Out of Scope

- In-session capture (`SetsTable`, `DeviationReasonSheet`) and its i18n keys.
- `file:src/lib/deviationCapture.ts` (read-only) and `file:src/lib/syncService.ts`.
- Deleting or migrating stored deviation data.
- Any replacement section on the recap.

## Acceptance Criteria

- [ ] The finish recap renders no `Adjustments` heading and no deviation row.
- [ ] `SessionNote` still renders when `onSaveNote` is provided, and the note still
      persists through `enqueueSessionNote`.
- [ ] `SessionAdjustments.tsx`, its test, and `useSessionDeviations.ts` are deleted; no
      import references them.
- [ ] `SetsTable` / `DeviationReasonSheet` / `syncService` / `session_deviation_events`
      are unchanged; the deviation arch test stays green.
- [ ] `deviation.debriefTitle` / `deviation.debriefEmpty` removed from EN + FR; other
      `deviation.*` keys intact.
- [ ] `docs/CONTEXT.md` **Deviation** entry reflects the new behaviour.
- [ ] `npm test`, `npm run lint`, `npx tsc -b` pass.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Alléger_le_récap_de_fin_#665.md`
- Tech Plan: `file:docs/Tech_Plan_—_Alléger_le_récap_de_fin_#665.md`
- ADR: `file:docs/adr/0026-deviation-storage.md`
- Observatory: `file:docs/Observatory_—_Deviations.md`
- Glossary: **Deviation**, **Deviation Reason** in `file:docs/CONTEXT.md`
