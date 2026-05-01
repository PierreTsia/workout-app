# Epic Brief — MCP — Read & Edit Programs (#276)

## Summary

Close the agent-driven program iteration loop in GymLogic's MCP server. Today an agent can create programs (with hardcoded prescription defaults) and read the active program's upcoming workouts only when a cycle is started — it cannot list other programs, cannot read them without a cycle, cannot address them by ID, and cannot edit them in place. This epic ships `list_programs`, `get_program_details`, `update_program`, extends `create_program` with optional sets/reps/weight, and exposes `program_id` across the read tools so an AI assistant can review, propose, and apply targeted program changes without recreating from scratch.

---

## Context & Problem

**Who is affected:** GymLogic users running an MCP-connected agent (Claude Desktop, Le Chat, Cursor, OpenClaw / Iris) for AI-assisted programming. The "Coach Iris" v2 program intent — an AI that helps iterate on training plans — is currently blocked by the gaps below.

**Current state:**
- `get_upcoming_workouts` (`file:supabase/functions/mcp/tools/getUpcomingWorkouts.ts`) is the only MCP tool exposing program structure. It returns "No active training cycle" and stops as soon as no cycle is running. It does NOT expose the active `program_id`.
- `create_program` (`file:supabase/functions/mcp/tools/createProgram.ts`) is hardcoded to `3 sets × 10 reps × 90s rest` — the agent cannot specify prescription at creation.
- No `list_programs`, `get_program_details`, or `update_program`. No MCP tool exposes a `program_id` today, so programs are unaddressable from an agent.
- `set_logs` and `sessions` join via `cycle_id`, not `workout_exercise_id` — historical data is decoupled from program-structure mutations.
- **Weight storage convention is per-equipment** (documented in `skills/gymlogic-mcp/SKILL.md` and grounded in the resolution of #263): `weight_logged` is **per-hand** for `dumbbell` / `kettlebell`, **total** for `barbell` / `machine` / `cable` / `ez_bar`, `0` for `bodyweight`. Any new write surface must follow this same convention to keep volume math comparable across read and write paths.
- `skills/gymlogic-mcp/SKILL.md` exists and documents the current 6-tool surface. Line 188 explicitly says *"User asks to modify one day of an existing program → Out of scope for MCP — create_program replaces the whole program"* — this epic invalidates that statement.

**Pain points:**

| Pain | Impact |
|---|---|
| Agent can't read a freshly-created program before the user starts a cycle | User must manually start a cycle just so the AI can read the plan — defeats the AI-review use case |
| Agent can't read non-active programs at all | A drafted "Mai 2026 v2" sitting unstarted is invisible to the AI |
| `create_program` ignores agent-supplied prescription | A request like "bench 4×8 @ 80kg" silently becomes `3×10` with no weight |
| No way to edit a program in place | Recreating from scratch is fragile (drops exercises, swaps weight conventions) and breaks program identity |
| No `program_id` exposed by any read tool | An agent cannot chain `read program → update program` — it has no addressable handle |
| Ambiguous weight semantics on write surface would replicate #263 | If `weight_kg` doesn't follow the per-equipment storage convention, dumbbell prescriptions silently misalign with `set_logs` and break volume math |

---

## Goals

| Goal | Measure |
|---|---|
| Agent can read any user program regardless of cycle state | `list_programs` + `get_program_details` return data on a fresh account with 0 cycles |
| Agent can address programs by stable ID | `program_id` is present in the output of `list_programs`, `get_program_details`, and `get_upcoming_workouts` |
| Agent can edit a program in place without recreating it | A "swap RDL for conventional DL, bump bench 3×10 → 4×8 @ 80kg" prompt resolves in ≤4 tool calls and zero `create_program` calls |
| `create_program` supports agent-controlled prescription | Optional `sets` / `reps` / `weight_kg` / `rest_seconds` per exercise; existing defaults preserved when omitted |
| Weight convention stays consistent across read and write | `weight_kg` on `create_program` / `update_program` follows the same per-equipment convention as `weight_logged` in `set_logs` (per-hand for unilateral, total otherwise) |
| Historical session data survives all program mutations | 0 rows of `set_logs` / `sessions` impacted by an `update_program` apply |
| Mid-cycle update is transparent | When a cycle is active, `update_program` apply succeeds AND its response carries an explicit warning naming the active cycle and the impact on remaining workouts |

---

## Scope

**In scope:**

1. **`list_programs`** — MCP tool returning all of the user's programs (id, name, is_active, day count, created_at). Works with or without an active cycle. **`program_id` is part of every entry.**

2. **`get_program_details`** — MCP tool returning the full structure of one program by UUID (days, exercises, prescriptions). Works with or without an active cycle. **`program_id` is included in the output for chainability.**

3. **`update_program`** — MCP tool to edit an existing program by ID. Defaults `dry_run: true` (consistent with `create_program`). Allowed mid-cycle, but the response carries an explicit warning when an active cycle exists, calling out the impact on the user's *remaining* workouts in that cycle.

   **Supported mutations (all v1):**
   - **Program metadata:** rename (`name`)
   - **Days:** add, remove, reorder, rename / re-label
   - **Exercises within a day:** add, remove, reorder
   - **Swap an exercise** (replace the `exercise_id` of an existing slot)
   - **Prescription per exercise:** change `sets`, `reps`, `weight_kg`, `rest_seconds`

   Patch format (full replacement vs domain ops vs JSON Patch) is left to the Tech Plan, but it must cover all the mutations above end-to-end.

4. **Extend `create_program`** with optional per-exercise `sets`, `reps`, `weight_kg`, `rest_seconds`. Backwards compatible — current defaults preserved when omitted. **`weight_kg` follows the per-equipment storage convention** (per-hand for `dumbbell` / `kettlebell`, total otherwise) — implicit, no new disambiguation field. The tool description must spell this out for zero-shot agents.

5. **Extend `get_upcoming_workouts`** to include the active `program_id` in its output (so an agent that reaches for "edit my current program" doesn't need a separate `list_programs` round trip).

6. **Update `skills/gymlogic-mcp/SKILL.md`** (file exists in this repo at `file:skills/gymlogic-mcp/SKILL.md`, currently 6 tools): add the new tools, document the weight convention for write ops, document the typical "list → read → propose → dry_run → apply" flow, and remove the now-stale L188 statement that single-day program edits are out of scope.

7. **E2E validation** of the read-→-propose-→-apply loop with **at least two MCP clients**, including OpenClaw / Iris (the primary external consumer documented in `docs/mcp-connect/openclaw.md`) plus one of Claude Desktop / Le Chat.

**Out of scope:**
- React app UI changes (this is server-side MCP only).
- Renaming or restructuring existing tools.
- Patch-format decision (full replacement vs domain ops vs JSON Patch) — Tech Plan tranchera.
- Schema/DB migrations — current `programs` / `workout_days` / `workout_exercises` shape is sufficient.
- Cycle lifecycle changes (start / abandon / finish) — not needed for this epic.
- Adding an explicit `weight_basis` / `weight_is_per_hand` flag to write ops — convention is implicit, anchored on the exercise's `equipment`.

---

## Success Criteria

- **Numeric:** On a fresh account with ≥2 programs and 0 active cycles, an agent completes `list_programs` → `get_program_details` → `update_program` (dry_run) → `update_program` (apply) in ≤4 tool calls with no error.
- **Numeric:** 0 rows of `set_logs` / `sessions` are mutated, deleted, or orphaned across any `update_program` apply (verified via DB diff in E2E).
- **Numeric:** `create_program` extended with explicit `sets: 4, reps: "8", weight_kg: 80` produces a `workout_exercises` row matching those values exactly. The same call with those fields omitted produces `3 / "10" / null` (current defaults preserved).
- **Numeric:** `create_program` for a dumbbell exercise with `weight_kg: 25` produces a `workout_exercises` row whose volume math (`weight_kg × 2 × reps × sets`) matches a `set_logs` row at `weight_logged: 25` for the same exercise — i.e. the per-equipment convention is preserved end-to-end.
- **Numeric:** `program_id` is present in 100% of responses from `list_programs`, `get_program_details`, and `get_upcoming_workouts` (when a program exists).
- **Qualitative:** A French prompt "remplace RDL par soulevé de terre conventionnel et passe le bench à 4×8 @ 80kg" resolves to a single `update_program` apply, not a `create_program`.
- **Qualitative:** When `update_program` runs while a cycle is active, the response text contains a visible warning naming (a) the active cycle, (b) explicitly that the change affects the user's *remaining* workouts in that cycle (not only future cycles or a template snapshot).
- **Qualitative:** `skills/gymlogic-mcp/SKILL.md` is updated: new tools documented, write-ops weight convention explicit, L188 stale entry removed, typical flow ("list → read → propose → dry_run → apply") in the agent context.
- **Qualitative:** OpenClaw / Iris executes the full read-→-propose-→-apply loop end-to-end without manual workarounds, validated in `docs/mcp-connect/openclaw.md` example prompts (at least one prompt updated to exercise `update_program`).
