# Epic Brief — MCP `update_program` preserves Exercise Slot identity

## Summary

`update_program` (`dry_run: false`) currently applies every day update as a
**wipe + reinsert** of the day's **Unified Day Sequence**. New
`workout_exercises.id` are minted, `set_logs.workout_exercise_id` is
`ON DELETE SET NULL` (#463), so the athlete's **Last Performance** detaches and
the progression engine bootstraps from the **Template Prescription** — a
targeted weight change silently resets progression. The same wipe recreates
`exercise_blocks`, detaching `block_id` history / PB. This epic replaces the
wipe with **in-place reconciliation**: match incoming day items to the existing
slots of that day, `UPDATE` in place (id preserved), `INSERT` the unmatched,
`DELETE` the leftover. The public MCP `exercises[]` contract is unchanged; the
`dry_run` preview gains an informative warning when a slot's history detaches.

---

## Context & Problem

**Who is affected:** any athlete editing an existing program through an
**External MCP Client** (Claude, Cursor, Le Chat) — the exact prompt *"change
mon développé couché à 60 kg"*.

**Current state:**
- `file:supabase/functions/mcp/lib/applyDayUpdate.ts` calls `wipeDaySequence`
  then `insertDaySequence` (`file:supabase/functions/mcp/lib/daySequence.ts`).
- Every solo row is deleted and re-inserted with a fresh `gen_random_uuid()`.
- `set_logs.workout_exercise_id` is `ON DELETE SET NULL` (ADR 0012 / #463), so
  the FK detaches; `get_last_performance_for_slots` requires a non-null FK on
  the live slot, so the engine falls back to the template.
- `exercise_blocks` are recreated too → `block_runs.block_id` and
  `set_logs.block_exercise_id` detach.

**Pain points:**
| Pain | Impact |
|---|---|
| Targeted weight change resets progression | The athlete's earned load is thrown away; next session restarts at the template load |
| Circuit history / PB detaches on any day edit | `block_id`-keyed trends and PBs are lost |
| No signal in the preview | The agent / athlete cannot tell a harmless edit from a history-detaching swap |

---

## User Stories

1. As an athlete, I want a targeted weight change on an exercise to keep my
   progression, so that the next session anchors on my new template load and
   keeps progressing instead of restarting.
2. As an athlete, I want swapping a movement to start a fresh slot, so that the
   new movement does not inherit the previous movement's logs (expected reset,
   #463).
3. As an athlete, I want editing one exercise to leave the history of every
   other slot and Circuit in the day untouched.
4. As an athlete, I want a Circuit in my day to keep its `id` across an edit, so
   that its completion-time trend and PB survive.
5. As an agent, I want the `dry_run` preview to warn me when a slot's history
   will detach, so that I can surface it to the athlete before applying.
6. As an agent, I want the `exercises[]` payload and the `dry_run` response
   shape to stay unchanged, so that existing clients keep working.
7. As an athlete, I want a weight change to open the **Manual Override Window**
   (bump `template_updated_at`), so that the engine anchors on the new template
   then progresses — not a return to initial loads.
8. As a maintainer, I want a regression test proving a weight change preserves
   `workout_exercises.id` / `set_logs.workout_exercise_id` and a swap mints a
   new id.

### Success measures

| Story # | Measure |
|---|---|
| 1 | A targeted weight change issues an `UPDATE` on the existing slot id — zero `DELETE` on `workout_exercises` for that slot |
| 4 | A matched Circuit keeps its `exercise_blocks.id` — zero `DELETE` on `exercise_blocks` for that block |
| 5 | `dry_run` `warnings[]` contains one detachment line per removed/swapped solo |

---

## Scope

**In scope:**
- In-place reconciliation of solos in `applyDayUpdate` (match by `exercise_id`,
  greedy, order of appearance).
- In-place reconciliation of blocks (match by `benchmark_circuit_id`, else by
  order), preserving `exercise_blocks.id` and `block_exercises.id`.
- Informative `dry_run` warning when a solo slot's history detaches.
- ADR 0030 + `docs/CONTEXT.md` **Exercise Slot** / **Last Performance** notes.
- Regression tests (weight change preserves id; swap mints a new id).

**Out of scope:**
- Changing the general progression engine.
- Changing the public MCP `exercises[]` contract or exposing slot ids.
- Repairing / rewriting production data.
- A second confirmation gate for swaps (the flow already has consent: echoed
  payload / **Preview Token**).

---

## Success Criteria

- **Numeric:** a targeted weight change on a slot with prior progression issues
  zero `DELETE` on `workout_exercises` and zero `INSERT` for that slot; the
  existing `id` is `UPDATE`d in place.
- **Qualitative:** a movement swap mints a new slot id (expected identity reset,
  #463); the `dry_run` preview warns when a slot's history detaches; the
  `exercises[]` contract and `dry_run` response shape are unchanged.
