# Example agent prompts — copy-pasteable flows

Each section below is a real conversation a user can have with any GymLogic-connected MCP client (Claude Desktop, Le Chat, Cursor, Iris, …) once the relevant tools are deployed. The flows are designed to **work zero-shot** — the tool descriptions and `skills/gymlogic-mcp/SKILL.md` (especially the *Discovery flow* section) point the agent at the right chain of calls without custom instructions.

If your client doesn't ingest the canonical SKILL.md (some run on tool descriptions only), each flow includes an optional copy-paste **Custom Instructions** block to nudge the agent into the right behavior.

---

## "Review my draft program before I start it"

User says: *"Review my Mai 2026 v2 before I start the cycle."*

Expected agent behavior:

1. Call `list_programs` to see what exists (filter by `include_archived: false`).
2. Identify the program matching the name (or ask if multiple match).
3. Call `get_program_details(id)` with the matched UUID.
4. Present a summary highlighting volume per muscle group, antagonist coverage, anything that looks off (very short rest periods, very high rep ranges, lopsided splits, etc).

Why this works zero-shot: the tool descriptions and the SKILL.md *Discovery flow* section explicitly chain `list_programs` → `get_program_details`. The agent doesn't need custom instructions to figure this out, but a system prompt can speed up the behavior on resistant clients.

### For Claude Desktop — paste in Custom Instructions

> When the user asks me to review, summarize, compare, or critique any of their GymLogic training programs, I will:
>
> 1. Call `list_programs` first to see all available programs.
> 2. Match the user's intent to a specific program ID, or ask if ambiguous.
> 3. Call `get_program_details(id)` to load the full structure.
> 4. Provide an opinionated review with concrete suggestions.

---

## "Compare two programs side by side"

User says: *"Compare Avril 2026 vs Mai 2026 v2."*

Expected agent behavior:

1. Call `list_programs` to find both program IDs by name.
2. Call `get_program_details` twice (in parallel if the runtime supports it) on the two IDs.
3. Return a side-by-side diff: muscles covered, total volume per muscle, exercise overlap, structural differences (number of days, weekly split).

Variant — when the user is mid-cycle and wants to compare against what's coming up rather than naming a second program:

1. Call `get_upcoming_workouts` to get the active program's id (now surfaced in the response header as `*(id: <uuid>)`*).
2. Call `list_programs(include_archived: true)` to find the candidate alternative.
3. Call `get_program_details` on the alternative.
4. Compare against what was returned by `get_upcoming_workouts` directly.

This second variant only works because `get_upcoming_workouts` now returns the active `program_id` in its header, and `get_workout_history` does the same per session — the bridging change from T72.

### For Claude Desktop — paste in Custom Instructions (extends the block above)

> When the user asks me to compare two GymLogic programs:
>
> 1. Resolve both program IDs via `list_programs` (or use the active program's `id` from `get_upcoming_workouts` if the user said "compare to what I'm doing now").
> 2. Call `get_program_details(id)` on each.
> 3. Show a diff table covering: total days, exercises per day, muscle coverage overlap, weekly volume by muscle group.