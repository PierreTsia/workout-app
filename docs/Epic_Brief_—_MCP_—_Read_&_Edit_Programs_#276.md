# Epic Brief — MCP — Read & Edit Programs (#276)

## Summary

Close the agent-driven program iteration loop in GymLogic's MCP server. Today an agent can create programs (with hardcoded prescription defaults) and read the active program's upcoming workouts only when a cycle is started — it cannot list other programs, cannot read them without a cycle, and cannot edit them in place. This epic ships `list_programs`, `get_program_details`, `update_program`, and extends `create_program` with optional sets/reps/weight, so an AI assistant can review, propose, and apply targeted program changes without recreating from scratch.

---

## Context & Problem

**Who is affected:** GymLogic users running an MCP-connected agent (Claude Desktop, Le Chat, Cursor, OpenClaw/Iris) for AI-assisted programming. The "Coach Iris" v2 program intent — an AI that helps iterate on training plans — is currently blocked by the gaps below.

**Current state:**
- `get_upcoming_workouts` (`file:supabase/functions/mcp/tools/getUpcomingWorkouts.ts`) is the only MCP tool exposing program structure. It returns "No active training cycle" and stops as soon as no cycle is running.
- `create_program` (`file:supabase/functions/mcp/tools/createProgram.ts`) is hardcoded to `3 sets × 10 reps × 90s rest` — the agent cannot specify prescription at creation.
- No `list_programs`, `get_program_details`, or `update_program`. No MCP tool exposes a `program_id` today, so programs are unaddressable from an agent.
- `set_logs` and `sessions` join via `cycle_id`, not `workout_exercise_id` — historical data is decoupled from program-structure mutations.

**Pain points:**

| Pain | Impact |
|---|---|
| Agent can't read a freshly-created program before the user starts a cycle | User must manually start a cycle just so the AI can read the plan — defeats the AI-review use case |
| Agent can't read non-active programs at all | A drafted "Mai 2026 v2" sitting unstarted is invisible to the AI |
| `create_program` ignores agent-supplied prescription | A request like "bench 4×8 @ 80kg" silently becomes `3×10` with no weight |
| No way to edit a program in place | Recreating from scratch is fragile (drops exercises, swaps weight conventions) and breaks program identity for analytics/history continuity |

---

## Goals

| Goal | Measure |
|---|---|
| Agent can read any user program regardless of cycle state | `list_programs` + `get_program_details` return data on a fresh account with 0 cycles |
| Agent can edit a program in place without recreating it | A "swap RDL for conventional DL, bump bench 3×10 → 4×8 @ 80kg" prompt resolves in ≤4 tool calls and zero `create_program` calls |
| `create_program` supports agent-controlled prescription | Optional `sets` / `reps` / `weight_kg` / `rest_seconds` per exercise; existing defaults preserved when omitted |
| Historical session data survives all program mutations | 0 rows of `set_logs` / `sessions` impacted by an `update_program` apply |
| Mid-cycle update is transparent | When a cycle is active, `update_program` apply succeeds AND its response carries an explicit warning naming the active cycle |

---

## Scope

**In scope:**
1. **`list_programs`** — MCP tool returning all of the user's programs (id, name, is_active, day count, created_at). Works with or without an active cycle.
2. **`get_program_details`** — MCP tool returning the full structure of one program by UUID (days, exercises, prescriptions). Works with or without an active cycle.
3. **`update_program`** — MCP tool to edit an existing program by ID. Defaults `dry_run: true` (consistent with `create_program`). Allowed mid-cycle, but the response carries an explicit warning when an active cycle exists. Patch format (full replacement vs domain ops vs JSON Patch) is left to the Tech Plan.
4. **Extend `create_program`** with optional per-exercise `sets`, `reps`, `weight_kg`, `rest_seconds`. Backwards compatible — current defaults preserved when omitted.
5. **Update `skills/gymlogic-mcp/SKILL.md`** to document the new tools, the mid-cycle warning convention, and the typical "list → read → propose → dry_run → apply" flow.
6. **E2E validation** of the read-→-propose-→-apply loop with at least one MCP client (Claude Desktop or Le Chat).

**Out of scope:**
- React app UI changes (this is server-side MCP only).
- Renaming or restructuring existing tools.
- Patch-format decision (full replacement vs domain ops vs JSON Patch) — Tech Plan tranchera.
- Schema/DB migrations — current `programs` / `workout_days` / `workout_exercises` shape is sufficient.
- Cycle lifecycle changes (start / abandon / finish) — not needed for this epic.

---

## Success Criteria

- **Numeric:** On a fresh account with ≥2 programs and 0 active cycles, an agent completes `list_programs` → `get_program_details` → `update_program` (dry_run) → `update_program` (apply) in ≤4 tool calls with no error.
- **Numeric:** 0 rows of `set_logs` / `sessions` are mutated, deleted, or orphaned across any `update_program` apply (verified via DB diff in E2E).
- **Numeric:** `create_program` extended with explicit `sets: 4, reps: "8", weight_kg: 80` produces a `workout_exercises` row matching those values exactly. The same call with those fields omitted produces `3 / "10" / null` (current defaults preserved).
- **Qualitative:** A French prompt "remplace RDL par soulevé de terre conventionnel et passe le bench à 4×8 @ 80kg" resolves to a single `update_program` apply, not a `create_program`.
- **Qualitative:** When `update_program` runs while a cycle is active, the response text contains a visible warning naming the active cycle and its impact on the user's next workouts.
- **Qualitative:** `skills/gymlogic-mcp/SKILL.md` is updated and the new typical flow ("list → read → propose → dry_run → apply") is documented for downstream agents (Iris, etc.).
