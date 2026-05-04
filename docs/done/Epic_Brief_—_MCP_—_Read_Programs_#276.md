# Epic Brief — MCP — Read Programs (#276)

## Summary

Ship two new MCP tools — `list_programs` and `get_program_details` — so an AI assistant connected to GymLogic can read any of the user's training programs **regardless of cycle state**. Today, the only program-aware tool (`get_upcoming_workouts`) silently bails when no cycle is active, blocking the "review my freshly-created program before I start it" use case. Also exposes `program_id` in `get_upcoming_workouts` and `get_workout_history` so an agent has an addressable handle on any program it sees, paving the way for the upcoming write surface.

This is **part 1 of 3 deriving from issue #276**, deliberately scoped to read-only mechanics so it can ship in days, get real usage feedback from Iris and Claude Desktop, and inform the design of the heavier follow-on epics:

- **Epic B** — extend `create_program` with optional per-exercise `sets`, `reps`, `weight_kg`, `rest_seconds`.
- **Epic C** — `update_program`: edit an existing program by ID, mid-cycle behavior, patch shape decisions.

---

## Context & Problem

**Who is affected:** GymLogic users running an MCP-connected agent (Iris/OpenClaw, Claude Desktop, Le Chat, Cursor) for AI-assisted programming. Today the AI is blind to any program that doesn't have an active cycle — including programs the user just drafted in the app and wants the assistant to review.

**Current state:**

- `get_upcoming_workouts` (`file:supabase/functions/mcp/tools/getUpcomingWorkouts.ts`) is the only MCP tool exposing program structure. It returns `"No active training cycle"` and stops as soon as no cycle is running.
- No tool exposes `program_id`. Agents can read the active program's contents (when a cycle exists) but have no addressable handle to chain into the future `update_program` tool.
- `programs` table has the columns relevant to read: `id`, `name`, `is_active`, `created_at`, `archived_at` (added by `file:supabase/migrations/20260315200000_add_archived_at_to_programs.sql`), plus `user_id` for RLS. Soft-archive convention: `archived_at IS NOT NULL` ⇒ archived.
- Existing skill doc `file:skills/gymlogic-mcp/SKILL.md` documents the current 6-tool surface. Line 188 says *"User asks to modify one day of an existing program → Out of scope for MCP — create_program replaces the whole program"* — this entry stays accurate during Epic A but needs a note pointing to the upcoming Epic C, then gets fully invalidated when Epic C lands.
- The "Coach Iris" v2 program intent — an AI that helps iterate on training plans — is currently blocked by these gaps.

**Pain points:**


| Pain                                                                           | Impact                                                                                             |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Agent can't read a freshly-created program before the user starts a cycle      | User must manually start a cycle just so the AI can read the plan — defeats the AI-review use case |
| Agent can't read non-active programs at all                                    | A drafted "Mai 2026 v2" sitting unstarted is invisible to the AI                                   |
| No `program_id` exposed by any read tool                                       | An agent cannot chain `read program → update program` (Epic C) — it has no addressable handle      |
| Soft-archived programs (`archived_at IS NOT NULL`) cannot be inspected via MCP | "Show me what I was running in January" requires opening the app manually                          |


---

## User Stories

### Browse & discover

1. As an **AI assistant**, I want to call `list_programs` and see all the user's non-archived programs in one shot, so that I can answer "which program do you want me to look at?" without poking around.
2. As an **AI assistant**, I want each entry of `list_programs` to tell me whether the program is the user's current one (`is_active`) and whether a cycle is in flight (`has_active_cycle`), so that I can distinguish "current and running" from "current but paused" from "draft".
3. As an **AI assistant**, I want each entry of `list_programs` to tell me the program's day count and creation date, so that I can present a meaningful summary line without a second tool call.
4. As an **AI assistant**, I want `list_programs` to default to excluding archived programs, so that I don't pollute my response with months-old content the user has explicitly retired.
5. As an **AI assistant**, I want to opt into archived programs with `include_archived: true`, so that I can answer prompts like "what was I doing in January?" without leaving a hole.
6. As a **GymLogic user**, when my account is brand new and I have zero programs, I want the assistant to say so cleanly and point me to the in-app builder, so that I'm not stuck in a confused loop.

### Drill into a single program

1. As an **AI assistant**, I want to call `get_program_details(id)` and receive the full structure (days, exercises, sets, reps, weights, rest), so that I can review or describe the program in one round-trip.
2. As an **AI assistant**, I want `get_program_details` to work whether or not a cycle is active, so that I can review a draft program before the user starts it.
3. As an **AI assistant**, I want `get_program_details` to surface stable IDs inline (`*(id: a3f...)*` next to each day and exercise), so that when Epic C ships I can address specific elements in `update_program` without guessing by index or name.
4. As an **AI assistant**, when I call `get_program_details(id)` on a UUID that doesn't exist or doesn't belong to this user, I want a clear error response (`"Program not found or you don't have access."`), so that I don't hallucinate program data.
5. As an **AI assistant**, when I call `get_program_details(id)` on an archived program, I want the response to succeed but flag `(archived)` in the header, so that I can warn the user before suggesting edits to it.
6. As an **AI assistant**, when I call `get_program_details(id)` on a program with zero days defined, I want a normal response with a `(empty program — no days defined)` note, so that I don't surface this benign state as an error.

### Chain into adjacent tools

1. As an **AI assistant**, I want `get_upcoming_workouts` to include the active `program_id` in its header, so that when the user says "modify what's coming up" I can chain into Epic C without a separate `list_programs` round trip.
2. As an **AI assistant**, I want `get_workout_history` to include the `program_id` of each session, so that during a retrospective I can offer "and here's the program structure that drove this session" without losing context.

### Discoverability & guidance

1. As a **GymLogic user**, I want my MCP-connected client (Iris and Claude Desktop) to know *when* to use these new tools — without me having to tell it — so that prompts like "review my draft program" just work zero-shot.
2. As a **GymLogic user setting up Claude Desktop for the first time**, I want a copy-paste system prompt I can drop into Custom Instructions, so that Claude reaches for the right tool sequence (`list → get_details → summarize`) on review-flavored prompts.

### Success measures


| Story # | Measure                                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 9       | 100% of days and exercises in `get_program_details` output carry an inline ID matching the database UUID format                              |
| 13–14   | 100% of `get_upcoming_workouts` and `get_workout_history` responses (when a program exists) surface `program_id`                             |
| 15      | The two example flows in `skills/gymlogic-mcp/SKILL.md` resolve correctly zero-shot in both Iris and Claude Desktop during manual validation |


Other stories are validated qualitatively through the user story itself.

---

## Scope

**In scope:**

1. `**list_programs` MCP tool** — returns `id`, `name`, `is_active`, `day_count`, `created_at`, `has_active_cycle` per program. Default sort `is_active DESC, created_at DESC`. Single optional argument `include_archived: boolean` (default `false`). No pagination, no other filters.
2. `**get_program_details` MCP tool** — accepts a single required `program_id: string` (UUID). Returns the full structure as **markdown with inline IDs** (e.g. `**Squat barre** *(id: a3f...)* — 3×10 @ 80kg`) on each day header and each exercise line. Works regardless of cycle state. Allowed on archived programs (with `(archived)` tag in the header).
3. **Extend `get_upcoming_workouts`** — add `*(id: ...)*` to the program header in its existing markdown output. No other behavior change.
4. **Extend `get_workout_history`** — add `*(program: <name>, id: ...)*` to each session block. No other behavior change.
5. **Extract pure formatters** into `file:supabase/functions/mcp/lib/format.ts`: `formatProgramListEntry`, `formatProgramDetails` (and adjustments for the two existing handlers above to consume them). Vitest coverage on the formatters: empty list, single-day program, empty program, archived program, mixed `has_active_cycle` states, ID injection format.
6. **Update `file:skills/gymlogic-mcp/SKILL.md`**:
  - Add the two new tools to the tool roster.
    - Add a "Discovery flow" section: `list_programs → get_program_details → (Epic C: update_program)`.
    - Document that `program_id` is now surfaced by `get_upcoming_workouts` and `get_workout_history`.
    - **Annotate L188** (the *"single-day editing is out of scope"* entry) with a forward-looking note: *"Single-day program editing arrives in Epic C (`update_program`) — until then, `create_program` is still the only write surface."* Removal of the entry itself happens in Epic C, not here.
7. **New file `docs/mcp-connect/example-prompts.md`** — copy-paste system prompts / custom instructions for Claude Desktop (and other MCP clients), with at minimum two example flows: *"Review my draft program"* and *"Compare two programs side by side"*.
8. **Manual end-to-end validation** on **two MCP clients**: Iris (primary) and Claude Desktop. One round each, validating both example prompts before merge.

**Out of scope:**

- Anything related to **writing** programs — extending `create_program` with sets/reps/weight (→ Epic B), `update_program` of any shape (→ Epic C), patch format decisions (→ Epic C), mid-cycle warning behavior (→ Epic C), per-equipment `weight_kg` convention on the write surface (→ Epic B & C).
- Adding `program_id` to `get_training_stats` — stats are aggregated multi-program, no clear use case.
- Pagination or filters on `list_programs` beyond `include_archived`.
- Any caching layer (client-side or server-side) — premature; revisit if Epic C surfaces real perf issues.
- Schema migrations — not needed; all required fields exist or are derivable (`day_count` = `COUNT(workout_days)`, `has_active_cycle` = `LEFT JOIN cycles WHERE finished_at IS NULL`).
- React app / mobile UI changes — server-side MCP only.
- Distinguishing 404 ("not found") from 403 ("not yours") in `get_program_details` errors — uniform message by design (security through obscurity).
- Performance work for XL programs (>15 days, >100 exercises) — outside the realistic target user profile.
- Rate-limiting per tool — if needed later, will be done at the Edge Function global level, not per tool.

---

## Success Criteria

- **Numeric:** On a fresh account with ≥2 programs and 0 active cycles, `list_programs` followed by `get_program_details(id)` completes in ≤2 tool calls and returns valid markdown for the chosen program.
- **Numeric:** 100% of days and exercises in `get_program_details` markdown output carry an inline `*(id: <uuid>)`* annotation matching the database UUID format.
- **Numeric:** 100% of `get_upcoming_workouts` and `get_workout_history` responses (when a program exists) surface `program_id` in their content text.
- **Qualitative:** Both example prompts in `docs/mcp-connect/example-prompts.md` ("Review my draft program", "Compare two programs side by side") resolve correctly **zero-shot** in Iris and Claude Desktop during manual validation, with no manual prompting beyond the user's natural-language request.
- **Qualitative:** A French prompt *"Montre-moi le programme Mai 2026 v2 avant que je le commence"* triggers `list_programs` → `get_program_details(id)` and produces a coherent summary, without the agent reaching for `get_upcoming_workouts` (which would fail since no cycle exists).
- **Qualitative:** `skills/gymlogic-mcp/SKILL.md` describes the new tools, the discovery flow, the new `program_id` surfacing in the two extended tools, AND L188 is annotated with the forward-looking Epic C note (full removal deferred to Epic C).
- **Qualitative:** Pure formatter unit tests in `supabase/functions/mcp/lib/format.test.ts` cover at minimum: empty list, single-day program, empty program (0 days), archived program flag, mixed `has_active_cycle` states.