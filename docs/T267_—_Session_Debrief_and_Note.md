# T267 — Session debrief (**S3**) + session note

## Goal

Give the captured deviations a reader, and capture the optional one-line **session note**. On the post-workout summary, the athlete sees the **Ajustements** (adjustments) of the session just logged and can add a free one-line note. This is the epic's only human-facing consumer; it never reads Jev.

User stories: **6** (one line about the session), **9** (the stored data is readable without re-capture).

## Mode

AFK.

## Slice

`file:src/components/workout/SessionSummary.tsx` → deviations query → **Écarts** section → `sessions.session_note` capture through `SessionFinishPayload` + `upsertSession` → i18n → vitest.

## Dependencies

T266 (the `session_deviation_events` table + `sessions.session_note` column and the offline queue).

## Scope

### Read path

- Query `session_deviation_events` for the finished `session_id`, joined to `set_logs` on `(session_id, log_slot/workout_exercise_id, set_number)` to render the prescribed → actual numbers. Keep it a single React Query hook (e.g. `file:src/hooks/useSessionDeviations.ts`) with the standard key shape.
- A pure formatter maps `reason_code` → the `deviation.reason.*` key and produces the `deviation.setInfo` line; unit-test it.

### S3 — debrief screen

Extend `file:src/components/workout/SessionSummary.tsx` (keep the existing trophy, stats grid, PR block, badges, and "Nouvelle séance" button):
- new section heading `deviation.debriefTitle` (**Ajustements** / **Adjustments**) listing one row per captured deviation: exercise name, set number, `prescribed → actual`, a reason chip (or `deviation.reason.none` when null), and the note when present;
- empty state `deviation.debriefEmpty` when there is no deviation;
- new section heading `deviation.sessionNoteTitle` with a one-line input (`deviation.sessionNotePlaceholder`).

### Session note capture

- Add `sessionNote?: string | null` to `SessionFinishPayload` in `file:src/lib/syncService.ts` and thread it through `upsertSession` / `ensureSession` / `processSessionFinish` into `sessions.session_note`.
- The note entered on S3 enqueues a `session_finish` upsert (or a targeted `sessions` update) carrying the note; offline-first, no visible error when the network is gone.

### i18n

`deviation.debriefTitle`, `deviation.debriefEmpty`, `deviation.reason.none`, `deviation.sessionNoteTitle`, `deviation.sessionNotePlaceholder` (already in `file:src/locales/{en,fr}/workout.json`). Reuse `deviation.reason.*` for the chips.

## Out of scope

- Any Jev call, verdict, or classification.
- Editing/deleting a deviation from the debrief (v1 is read + note only).
- A dedicated history surface for deviations.
- `set_skipped` / `exercise_swapped` / `session_incomplete` (separate epics).

## Acceptance Criteria

- [ ] After a session with at least one load deviation, S3 lists it: exercise, set number, prescribed → actual, reason label (or `deviation.reason.none`).
- [ ] A session with no deviation shows `deviation.debriefEmpty`, not an empty list.
- [ ] The session note entered on S3 is persisted to `sessions.session_note` (offline-first, no loss).
- [ ] EN + FR keys match the `deviation.*` contract exactly.
- [ ] A unit test covers the pure `reason_code` → key + `setInfo` formatter.

## References

- Epic Brief + Tech Plan: [#566](https://github.com/PierreTsia/workout-app/issues/566)
- ADR: `file:docs/adr/0026-deviation-storage.md`
- Glossary: **Deviation**, **Deviation Reason**, **Session** in `file:docs/CONTEXT.md`
- Upstream: T266
