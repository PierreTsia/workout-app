# T266 — Capture `load_deviation` end-to-end

## Goal

First vertical slice of the deviation data-gathering epic. When the athlete changes a set's weight or reps away from its **Prescription Snapshot**, a non-blocking reason sheet appears; the chosen reason — or an explicit skip — is persisted as one `session_deviation_events` row, offline-first. This ticket also lands the shared foundation (table, RLS, vocabulary, `sessions.session_note`) that T267 consumes.

User stories: **1** (one-tap why on a load change), **2** (skip the question, never blocked), **11** (the question fires only on a real deviation).

## Mode

AFK.

## Slice

migration (`session_deviation_events` + `sessions.session_note`) → RLS + arch test → `file:src/types/deviation.ts` → `file:src/lib/deviationCapture.ts` → `file:src/lib/syncService.ts` (`enqueueDeviation` + drain) → `file:src/components/workout/DeviationReasonSheet.tsx` (**S1**) → `file:src/components/workout/SetsTable.tsx` wiring → i18n → vitest.

## Dependencies

None. Unblocks T267.

## Scope

### Migration

New file `file:supabase/migrations/20261001130000_session_deviation_events.sql`. Shape per ADR `file:docs/adr/0026-deviation-storage.md` — the event **references** the set (no duplicated `prescribed_*` / `actual_*`).

```sql
ALTER TABLE sessions ADD COLUMN session_note text;

CREATE TABLE session_deviation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  workout_exercise_id uuid REFERENCES workout_exercises(id) ON DELETE SET NULL,
  exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL,
  set_number int,
  kind text NOT NULL CHECK (kind IN ('load_deviation')),
  reason_code text CHECK (reason_code IN ('pain','fatigue','strong','equipment','form','other')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_deviation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own deviation events" ON session_deviation_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX session_deviation_events_session_idx ON session_deviation_events (session_id);
CREATE INDEX session_deviation_events_user_created_idx ON session_deviation_events (user_id, created_at DESC);
```

`kind` and `reason_code` are `text + CHECK` (not Postgres enums) so extending the vocabulary or kinds is a one-line migration.

### Arch test

New `file:src/test/sessionDeviationEvents.arch.test.ts` reading the migration source and asserting: RLS is enabled, the own-row policy is present, `user_id` defaults to `auth.uid()`, and `kind` admits only `load_deviation` in v1. Follow the pattern of `file:src/test/securityDefiner.arch.test.ts`.

### Types & vocabulary

New `file:src/types/deviation.ts`: `DeviationKind = "load_deviation"`, `DeviationReason = "pain" | "fatigue" | "strong" | "equipment" | "form" | "other"`, `DeviationEvent`, and the ordered `DEVIATION_REASONS` list driving the S1 chips.

### Detection (pure)

New `file:src/lib/deviationCapture.ts`:
- `isLoadDeviation(row, prescription): boolean` — compares a reps row's confirmed weight/reps against the **Prescription Snapshot**; no I/O, no i18n.
- `buildLoadDeviationPayload({ sessionId, workoutExerciseId, exerciseId, setNumber, reasonCode, note })` — the enqueue payload.

### Persistence (offline-first)

Extend `file:src/lib/syncService.ts`, mirroring `enqueueSetLog`:
- add `"deviation"` to the `QueueItem` union and a `DeviationPayload` type;
- `enqueueDeviation(payload)` resolves the real session id via the existing `resolveSessionMeta`, pushes into the same `offlineQueue:<userId>`, dedupes on `${realSessionId}|deviation|${workoutExerciseId}|${setNumber}` so an edited reason overwrites;
- drain: `processDeviation` upserts into `session_deviation_events`; failures survive for the next drain. Reuse `scheduleImmediateDrain()`.

### UI (S1)

New `file:src/components/workout/DeviationReasonSheet.tsx`, built on the existing drawer + `ToggleGroup` pattern of `file:src/components/workout/RirDrawer.tsx`:
- title `deviation.loadPrompt`; subtitle `deviation.setInfo` (prescribed → actual);
- a single-select chip row of `deviation.reason.*` (a11y label `deviation.reasonGroupLabel`);
- a one-line note input (`deviation.notePlaceholder`);
- primary `deviation.save` and ghost `skip` (existing key). The button is disabled until a reason or a note is present.
- Non-blocking: it must not block the RIR confirm nor the rest timer; the sheet can be dismissed with `skip`.

Wire in `file:src/components/workout/SetsTable.tsx`:
- on `updateField` (`:335`) track that the row diverges; at `confirmRir` (`:393`), if `isLoadDeviation(...)` against `readLockedPrescription()` (`:141`), open the sheet for that set. The chosen reason/note is attached to the same row state (as `manuallyEdited` already is) and included in the `enqueueSetLog` payload AND `enqueueDeviation`. Skip → `reason_code = null`, event still enqueued.
- One sheet at a time; reopening for the same set replaces the pending reason.

### Screens

S1 mockup (Stitch, project `projects/7622141005727868523`). S3 belongs to T267.

### i18n

Land the `deviation.*` contract (already added to `file:src/locales/{en,fr}/workout.json` in this epic's prep): reuse existing key `skip`. EN + FR values must match exactly.

## Out of scope

- `set_skipped`, `exercise_swapped`, `session_incomplete` — separate epics; the table's `CHECK` admits **only** `load_deviation` in v1.
- The session debrief screen (**S3**) and the session-note capture — T267.
- Any Jev call, verdict, or classification — ADR `file:docs/adr/0026-deviation-storage.md`.
- The final visual design of the sheet (v1 functional is enough).
- `manuallyEdited` persistence — it stays client-only (cascade suggestions).

## Acceptance Criteria

- [ ] Arch test proves `session_deviation_events` is RLS-scoped own-row (`auth.uid() = user_id`) and that `kind` admits only `load_deviation`.
- [ ] End-to-end: changing weight/reps away from the Prescription Snapshot and confirming the set opens S1; picking a reason persists a `session_deviation_events` row (`reason_code` non-null).
- [ ] Tapping **Passer** persists the same event with `reason_code = null` — no deviation is lost.
- [ ] A conforming set (actual == prescribed) produces **no** event (no parasite capture).
- [ ] The reason is included offline-first through the existing queue and drains with 0 loss; the RIR confirm and rest timer are unaffected.
- [ ] EN + FR keys match the `deviation.*` contract exactly.

## References

- Epic Brief + Tech Plan: [#566](https://github.com/PierreTsia/workout-app/issues/566) (original scope, pre-grill)
- ADR: `file:docs/adr/0026-deviation-storage.md`
- Glossary: **Deviation**, **Deviation Reason**, **Prescription Snapshot**, **Manual Override Window** in `file:docs/CONTEXT.md`
- Downstream: T267
