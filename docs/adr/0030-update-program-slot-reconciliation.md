# ADR 0030 — `update_program` preserves Exercise Slot identity by in-place reconciliation

- **Status:** Accepted
- **Date:** 2026-10-06
- **Decided in:** grill session for [#666](https://github.com/PierreTsia/workout-app/issues/666)
- **Relates to:** ADR [0012](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0012-slot-scoped-last-performance.md) (slot-scoped **Last Performance**), ADR [0006](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0006-decouple-template-from-progression-engine.md) (**Manual Override Window**)

## Context

`update_program` (`dry_run: false`) applied every day update as a **wipe +
reinsert** of the day's **Unified Day Sequence**
(`file:supabase/functions/mcp/lib/applyDayUpdate.ts` → `wipeDaySequence` +
`insertDaySequence`). Every solo row was deleted and re-inserted with a fresh
`gen_random_uuid()`.

Since ADR 0012 / #463, `set_logs.workout_exercise_id` is the **Exercise Slot**
identity and is `ON DELETE SET NULL`. A wipe detaches the FK, and
`get_last_performance_for_slots` requires a non-null FK on the live slot — so
the progression engine bootstraps from the **Template Prescription**. The exact
prompt *"change mon développé couché à 60 kg"* silently reset the athlete's
earned progression. The same wipe recreated `exercise_blocks`, detaching
`block_runs.block_id` (Circuit Completion Time / PB) and
`set_logs.block_exercise_id`.

The identity was thrown away **at write time** — not a value or read bug.

## Decision

We will:

1. **Reconcile in place instead of wiping.** In the apply path, match incoming
   day items to the existing slots of that day:
   - **Solos** — greedy by `exercise_id`, order of appearance → `UPDATE` in
     place (id preserved); unmatched incoming → `INSERT`; leftover existing →
     `DELETE`.
   - **Blocks** — match by `benchmark_circuit_id` first; the order fallback
     pairs **generic-to-generic only** (both sides without a
     `benchmark_circuit_id`) → `UPDATE` in place (`exercise_blocks.id`
     preserved). A named Circuit with no identity match is a genuine swap: it
     is `INSERT`ed and the old block `DELETE`d, minting a new identity — the
     same rule as a solo movement swap. Unmatched generic → `INSERT`; leftover
     → `DELETE`. A matched block's `block_exercises` are reconciled in place
     too, so `set_logs.block_exercise_id` survives.
2. **Keep the public MCP `exercises[]` contract unchanged.** No ids are exposed;
   reconciliation is server-side.
3. **Treat a movement swap as a new slot.** A different `exercise_id` does not
   match, so the old slot is deleted and a new one inserted — the expected
   identity reset of #463.
4. **Warn, do not gate.** The `dry_run` preview appends an informative warning
   when a solo slot's history detaches (exercise removed/swapped). No extra
   confirmation gate: the flow already has consent (echoed payload / **Preview
   Token**, ADR 0028).
5. **Let a weight change open the Manual Override Window.** An in-place `UPDATE`
   bumps `template_updated_at` (ADR 0006 trigger) → the engine anchors on the
   new template then progresses. That is the desired behaviour, not a return to
   initial loads.

## Consequences

- **Positive:** a targeted prescription change keeps the slot's progression;
  Circuit `block_id` history / PB survives an edit; editing one exercise leaves
  the other slots and Circuits of the day untouched. The `dry_run` preview
  distinguishes a harmless edit from a history-detaching swap.
- **Negative:** the apply path now reads the day's existing rows before writing
  (two extra `SELECT`s per updated day). The matching is heuristic — a swap onto
  the same `exercise_id` is indistinguishable from an edit, which is exactly the
  ADR 0012 rule. Block detachment is **not** warned in v1 (the `dry_run`
  snapshot does not embed blocks); only solo detachment is.
- **Follow-ups:** warn on block detachment if the snapshot gains blocks; a
  pedagogical UI when a swap resets progression.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Keep wipe + reinsert, backfill the FK after** | The new ids are minted before the backfill; matching old logs to new slots is ambiguous when the same exercise appears twice — reintroduces #463. |
| **Match solos by `sort_order` instead of `exercise_id`** | A reorder would then preserve identity across a movement swap, attaching the previous movement's logs to the new one. |
| **Match blocks by order only** | A reordered named Circuit would lose its `block_id`; benchmark identity is the stable key. |
| **Fall back to order for any unmatched Circuit** | A named swap (Cindy → Murph) or a named Circuit dropped beside a generic one would silently reuse the old block's identity and rewrite `benchmark_circuit_id`; a swap must mint a new identity. The fallback is therefore generic-to-generic only. |
| **Add a confirmation gate for swaps** | The flow already has consent (echoed payload / Preview Token); a swap is an expected reset, not a destructive surprise. |
| **Expose slot ids in `exercises[]`** | Breaks the public MCP contract for third-party agents; reconciliation is a server concern. |
