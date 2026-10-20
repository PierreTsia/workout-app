# ADR 0032 — The in-session anchor rides its own column, never the Prescription Snapshot

- **Status:** Accepted
- **Date:** 2026-10-20
- **Decided in:** P1 analysis for the progression-engine epic [#705](https://github.com/PierreTsia/workout-app/issues/705)
- **Relates to:** ADR [0006](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0006-decouple-template-from-progression-engine.md) (Template Prescription vs Progression Engine), ADR [0012](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0012-slot-scoped-last-performance.md) (slot-scoped **Last Performance**), ADR [0026](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0026-deviation-storage.md) (deviation storage)

## Context

The intra-session engine (`file:src/lib/rirSuggestion.ts`) adjusts the target *within* a session — a
RIR cascade can prescribe a deload mid-session. Nothing carried that decision to the next session:
`prescribed_*` captures the **session-start** target, and `buildPrescription` reads it back for
`volume.current` (`file:src/lib/progression.ts`). A deload applied three sessions running left the
fourth anchored on the first. The two engines did not talk.

The obvious fix — write the served target into `prescribed_*` — was rejected after three checks:

1. **`prescribed_*` is the deviations observatory's measurement substrate.** There is no server
   object: `file:docs/Observatory_—_Deviations.md` is hand-run SQL, and its *direction × reason* query
   computes direction by joining `set_logs.prescribed_*` to `*_logged`. ADR 0026 §2 makes the
   non-copying deliberate ("the numbers are read by joining `set_logs`"). Overwriting `prescribed_*`
   collapses every deloaded set into the query's `flat` bucket — which the note itself calls "a data
   smell, not a reading" — and removes the baseline its own *anchor rule* is defined against.
2. **`CONTEXT.md` publishes the snapshot's single rule**: `prescribed_*` = what the engine prescribed
   for this session; mid-session edits move `reps_logged` / `weight_logged`, not the snapshot.
3. **The weight axis already answered half of this the other way.** Reading `prescribed_weight` made
   the engine "read back its own stale bootstrap suggestion forever" (#381); it now reads
   `weight_logged`. `repair_prescribed_snapshot_pollution.sql` records that the column was polluted
   once before.

Two structural facts shaped the mechanism. The snapshot is written **per set, at log time**, from the
client payload — not at session finish (`processSessionFinish` refuses to write prescription fields,
ADR 0006). And the two **Last Performance** readers order sets **oppositely** —
`useLastSessionDetail` by `logged_at DESC`, `get_last_performance_for_slots` by `set_number ASC` — so
`lastPerformance[0]` cannot address "the last set".

## Decision

We will:

1. Add a nullable column `set_logs.anchor_reps`: the rep target **actually in force at the last logged
   set**.
2. **Stamp it in the cascade**, in `SetsTable.confirmRir`: the anchor rides the rows the intra-session
   cascade moves, and only when the cascade *decided* the reps — the triggering set hit the plan
   exactly (`triggering.reps === prescription`) **and** the suggested reps differ from it. When the
   triggering set missed, `weightFirstRule` / `repsOnlyRule` merely *echo* the athlete's own value
   (`reps: String(currentReps)`), and such an echo must never become the anchor. A manual edit clears
   the anchor (`updateField` sets `anchorReps: undefined`).
3. Read it as the value of the **last logged set of the session** (highest `set_number`), explicitly —
   never `lastPerformance[0]`.
4. Use `anchor_reps ?? prescribed_reps` for `volume.current`. The weight axis is untouched: for
   weight-first equipment a deload lowers the weight, which already propagates through `weight_logged`.
   The Manual Override Window still wins.
5. Keep `prescribed_*` pristine. The deviations observatory, `CONTEXT.md`'s single rule, and
   `HOLD_INCOMPLETE` keep their semantics.
6. Carry the column through `get_last_performance_for_slots` and both readers.

## Consequences

- **Positive:** a deliberate in-session deload reaches the next prescription; `prescribed_*` still
  means "what the engine prescribed at session start"; no finish-time writeback is reintroduced; the
  derivation is one comparison, with no new row state to keep in sync.
- **Negative:** one more nullable column on `set_logs`; the read must special-case "last set by
  `set_number`" and must not reuse the `[0]` convention; the RPC changes. Rows predating the change —
  and any set with no engine move — carry NULL and fall back to `prescribed_reps`.
- **Known limit — the anchor lives on the last set only.** Because the read takes the highest
  `set_number`, an anchor set on an earlier set is dropped if the *last* set carries none — either
  because the athlete hand-edited it (`manuallyEdited` → null) or because it was never logged after
  the cascade. The deload then falls back to `prescribed_reps`. This is the cost of one value per
  session; a per-set read is possible later if the case proves common.
- **Follow-ups:** the duration axis (`anchor_duration_seconds`) if the same hole is confirmed there;
  P2 / P3 read the anchor rather than re-deriving it.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Write the served target into `prescribed_*`** | Breaks the observatory's direction query, `CONTEXT.md`'s single rule, and re-creates #381. |
| **Write the shift back into the Template Prescription at finish** (Manual Override Window) | The exact ADR 0006 / #373 banned pattern: a finish-time writeback that corrupted Builder edits and the engine's own reads. |
| **Read the raw actual `reps_logged` for `volume.current`** | Ratchets the target down on a genuine miss (`HOLD_INCOMPLETE` loses its meaning). Track-reality is safe for weight, not for reps. |
| **Derive it at log time (`reps ≠ prescription && !manuallyEdited`)** | Tried, then rejected: the cascade echoes the athlete's actual reps (`String(currentReps)`), so a typed *miss* propagated into untouched sets looked exactly like an engine move — it would ratchet the target down (Copilot review, PR #706). The decision must be taken where the intent exists: in the cascade. |
| **A separate `(session, slot)` anchor table** | Unambiguous grain, but a new table + RLS + arch test where one nullable column and an explicit read suffice. |
| **Store the anchor on the first set only** | Dies on the ordering divergence between the two readers, and the write site cannot know which set will be last. |
