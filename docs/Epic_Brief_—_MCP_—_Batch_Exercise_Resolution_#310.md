# Epic Brief — MCP — Batch Exercise Resolution #310

## Summary

Replace the multi-call `search_exercises` + `get_exercise_details` dance with a single batch tool, `resolve_exercises`, that takes a list of exercise names and returns UUIDs plus the catalog metadata needed to build or edit a program. Cuts ~10x the MCP round-trips for "build me a program" and "update my program" autonomous flows, slashes user token quota burn, and brings the propose-confirm-act handshake within reach of free-tier conversations.

---

## Context & Problem

**Who is affected:**
- End users asking AI agents (Claude Desktop, Cursor, Le Chat, generic MCP clients) to build or edit multi-day training programs.
- AI agents themselves, whose autonomous flow currently fires 20-40 MCP calls before a single program lands.

**Current state:**
- `file:supabase/functions/mcp/tools/searchExercises.ts` only emits the exercise UUID **on a single match** — multi-match results require the agent to narrow down with a second (or third) call. Footer text literally instructs the agent to "search again with the user's choice."
- `file:supabase/functions/mcp/tools/createProgram.ts`'s tool description tells the agent to call `get_exercise_details` first to confirm `weight_convention`, adding N more calls (one per weighted exercise).
- Verified against a real conversation screenshot from issue #310: ~38 search calls + ~12 details calls for a 12-exercise, 3-day beginner full-body program. Roughly 50 round-trips for one program creation.
- `weight_convention` is fully derived from `equipment` via `file:supabase/functions/mcp/lib/format.ts` (`formatWeightConvention`) — no DB schema work needed to surface it elsewhere.
- Edge Functions are stateless — no persistent cache between calls.

**Pain points:**
| Pain | Impact |
|---|---|
| User waits 30s+ between "build me a program" and the dry-run preview | Drop-off, poor first impression vs the in-app AI generator |
| Free-tier token quota exhausted before program is created | User cannot iterate on the program in the same session |
| Agent narrowing loop (e.g. "Now let me search for specific exercises..." → 26 steps in one block) | Conversation feels broken; users lose trust in the AI workflow |
| Existing tool descriptions push the agent toward inefficient paths | Even after shipping a faster tool, habit-bias may keep the old flow |

---

## User Stories

1. As an **AI agent**, I want to resolve a list of exercise names to UUIDs in a single call, so that I can build a multi-day program without 30+ tool round-trips.
2. As an **AI agent**, I want each resolved exercise to include `weight_convention`, `measurement_type`, and `default_duration_seconds`, so that I can call `create_program` immediately without an extra `get_exercise_details` per exercise.
3. As an **AI agent**, I want ambiguous matches (close-scoring candidates) flagged with up to 2 alternates, so that I can surface them to the user instead of silently picking the wrong variant.
4. As an **AI agent**, I want unresolved queries (zero matches) returned as `{ matches: [], reason: "no_match" }` within the same response, so that one missing exercise does not fail the whole batch.
5. As an **AI agent**, I want clear, opinionated tool descriptions distinguishing `resolve_exercises` (name → ID) from `search_exercises` (browse by filters), so that I pick the right tool without second-guessing.
6. As an **AI agent updating a program** (`update_program` swap flow), I want the same batch resolution available, so that swapping multiple exercises does not regress to per-exercise searches.
7. As an **end user**, I want "build me a program" to complete in under 10 seconds instead of 30-60s, so that I'm not staring at a thinking spinner.
8. As an **end user**, I want fewer of my free-tier tokens consumed per program request, so that I can iterate (refine, swap, regenerate) within the same conversation.
9. As an **end user**, when an exercise name is genuinely ambiguous (e.g. "leg press" → multiple variants), I want my AI agent to surface the options and let me pick, so that I get the program I actually wanted.
10. As an **end user**, when a name does not exist in the catalog (e.g. "trap bar deadlift"), I want my AI agent to either retry with a broader term or flag it explicitly, so that I'm not blindsided post-creation by a missing exercise.
11. As an **MCP server maintainer**, I want the new tool to coexist with `search_exercises` rather than replace it, so that browse-by-filter intent ("show me chest exercises with dumbbells", "what's a good biceps exercise") continues to work for the agent.
12. As an **MCP server maintainer**, I want `skills/gymlogic-mcp/SKILL.md` and the tool descriptions updated together, so that all agent entry points (description-only clients and skill-aware clients alike) consistently steer toward the right catalog tool.

### Success measures

| Story # | Measure |
|---|---|
| 1, 7 | Median tool calls within the **resolve → create_program (dry_run) → create_program (apply)** sub-flow ≤ **3** (was ~20-40); ceiling = `1 resolve_exercises + 2 create_program calls`. *Excludes pre-flight context-gathering reads* (`list_programs`, `get_upcoming_workouts`, `get_training_stats`) the agent may run before deciding to build a program. |
| 2 | Zero `get_exercise_details` calls during a `create_program` flow when the agent uses the new tool |
| 7 | Wall-clock time from "build me a program" to dry-run preview echoed to user ≤ **10s** P50, ≤ **20s** P95 |
| 8 | Token consumption per autonomous program creation reduced by ≥ **70%** vs. baseline (issue #310 screenshot, measured on Claude Sonnet free tier) |

---

## Scope

**In scope:**
1. New MCP tool `resolve_exercises` with input `{ queries: string[] }`. Per-query response carries top-1 match, optional alternates on ambiguity, and bundled catalog metadata (`weight_convention`, `measurement_type`, `default_duration_seconds`).
2. Score-gap ambiguity detection (top-1 vs top-2 similarity delta, threshold ~0.1) at the Postgres / Edge Function layer. Substring-rank-0 ties are treated as ambiguous.
3. Per-query null on no-match (uniform response shape regardless of outcome — every input query gets a result row).
4. Updated tool descriptions for **both** `resolve_exercises` AND `search_exercises` to disambiguate intent (name-resolve vs filter-browse).
5. Updated `skills/gymlogic-mcp/SKILL.md`: new tool reference, "Catalog tools — which one when" decision table near the top, revised worked examples for Pattern 3 (lookup), Pattern 4 (program design), and the `update_program` swap example.
6. Updated `create_program` tool description to drop the "call `get_exercise_details` first" guidance (now redundant — `resolve_exercises` returns the convention).
7. MCP protocol version bump (`v0.5.0` — additive, non-breaking) and `CHANGELOG.md` entry.

**Out of scope:**
- Removing or replacing `search_exercises` (deferred — measure agent adoption first over a **≥ 2-week observation window** of post-launch agent traffic; revisit then with concrete data: kill if `search_exercises` calls drop to near-zero in autonomous flows, or escalate the steering mechanism — deprecation warning in tool description, `tools/list` exclusion behind a feature flag — if usage stays stubbornly high).
- Per-query filters in `resolve_exercises` input (`{ name, muscle_group?, equipment? }`). Defer until name-only proves insufficient in real agent traces. Adding optional fields later is non-breaking.
- Optional `include_details: true` flag to bundle the full instructions blob in `resolve_exercises` response. Pattern 3 (single-exercise lookup) stays at 2 calls (`resolve_exercises` + `get_exercise_details`), which is acceptable.
- Allowing `create_program` to accept exercise names directly (Option 2 in issue #310 comments — rejected as brittle with similar names).
- Cross-call cache layer in the MCP server (Option 3 — rejected, Edge Functions are stateless).
- Backward-compat alias for `search_exercises_batch` (the name floated in the issue comments) — we commit to `resolve_exercises` as the canonical name.
- Production instrumentation / dashboard for `tool_calls_per_create_program` metric. Tracked separately as a follow-up; useful for proving the win in production but not blocking shipping.

---

## Success Criteria

- **Numeric**: median tool calls per autonomous `create_program` flow ≤ 3, with ceiling of `1 resolve_exercises + 2 create_program calls (dry_run + apply)`.
- **Numeric**: token consumption per autonomous program creation reduced by ≥ 70% on Claude Sonnet free tier vs. the baseline screenshot in issue #310.
- **Numeric**: wall-clock time from prompt to dry-run preview ≤ 10s P50.
- **Qualitative**: a real autonomous prompt ("build me a complete beginner weekly workout with 3 sessions") reproduces the issue scenario in ≤ 3 tool calls, without the agent narrating "Let me search for specific exercises..." multiple times.
- **Qualitative**: agents (Claude, Cursor, generic MCP clients) reach for `resolve_exercises` over `search_exercises` when the user's prompt names specific exercises — verified via at least 5 representative manual end-to-end prompts post-launch covering: build program, update-swap exercise, browse-by-muscle, single exercise lookup, ambiguous-name handling.
