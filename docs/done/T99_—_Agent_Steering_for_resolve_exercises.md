# T99 — Agent Steering for `resolve_exercises`

## Goal

Redirect agent attention from the multi-call `search_exercises` + `get_exercise_details` dance to the new `resolve_exercises` tool across every steering surface (per-call tool descriptions AND session-start SKILL.md content) in a single, coherent change. Without this work, the new tool from T98 exists but agents won't reach for it consistently — the perf win never materializes.

Addresses Epic Brief stories **5, 6, 12**: clear tool-purpose distinction so agents pick the right tool; `update_program` swap flow gets the same batching win as `create_program`; SKILL.md and tool-description coherence ensures all agent entry points (description-only clients AND skill-aware clients) align.

## Mode

**AFK** — copy is mechanical from the Tech Plan's existing description sketches; SKILL.md updates are deterministic edits to existing patterns. No copy approval beyond the Tech Plan's locked decisions.

## Slice

Single coherent agent-steering layer:
`tools/searchExercises.ts (description revision)` → `tools/createProgram.ts (TOOL_DESCRIPTION revision)` → `SKILL.md (decision table + Pattern 3 + Pattern 4 + update_program worked examples + Edge Cases row)`.

End-to-end demoable: after merge, an agent prompted with "build me a 4-day program" reaches for `resolve_exercises` instead of N × `search_exercises` + N × `get_exercise_details`.

## Dependencies

**T98** — cannot steer agents toward a tool that doesn't yet exist in the registry. T99 must land **after** T98 is on `main`.

## Scope

### 1. Modified file — `supabase/functions/mcp/tools/searchExercises.ts`

Update the `description` field to add explicit cross-tool steering. Approximate copy (refine for tone consistency with sibling tools):

> Browse the exercise catalog by muscle group, equipment, or difficulty filters. Use this when you don't yet have specific exercise names in mind — e.g. "find chest exercises with dumbbells", "what's a good biceps exercise". **If you already know the names of the exercises you want (e.g. building a program from a list), use `resolve_exercises` instead — it batch-resolves names to UUIDs in a single call and returns the catalog metadata you'll need for `create_program`/`update_program`.**

No behavioural change to the tool itself. Description-only edit.

### 2. Modified file — `supabase/functions/mcp/tools/createProgram.ts`

Update the `TOOL_DESCRIPTION` constant. Specifically:

- **Drop** the line: *"Call `get_exercise_details` first to confirm the convention (`weight_convention` field)."* (currently in the "Weight conventions" paragraph around lines 110-116).
- **Replace** with: *"Use `resolve_exercises` first to get UUIDs + the `weight_convention` field for each exercise in one call — no need to follow up with `get_exercise_details` per exercise."*
- Verify no other paragraphs in `TOOL_DESCRIPTION` reference `get_exercise_details` for convention guidance. Leave references to `get_exercise_details` for other purposes (instructions, video, etc.) untouched.

**Do NOT touch** `LEGACY_MIGRATION_ERROR_MESSAGE` in `file:supabase/functions/mcp/lib/createProgramValidation.ts` — that's a v0.2.x → v0.3.x migration message, not v0.5.x guidance.

### 3. Modified file — `skills/gymlogic-mcp/SKILL.md`

Multi-section coherent rewrite. Each subsection below is a discrete edit:

#### 3a. Add a "Catalog tools — which one when" decision table

Insert near the top of the "Tool reference" section (around line 65, just above the existing 9-tool table). Format:

| User intent / agent state | Tool | Why |
|---|---|---|
| Agent already has specific exercise NAMES in mind ("bench press", "squat", "leg press") and needs UUIDs to build/edit a program | `resolve_exercises` | One call resolves all names to UUIDs + bundles `weight_convention` / `measurement_type` / `default_duration_seconds`. Use this for `create_program` / `update_program` flows. |
| Agent needs to BROWSE the catalog by muscle group, equipment, or difficulty ("find chest exercises with dumbbells", "biceps exercise") | `search_exercises` | Returns a filtered list with full metadata. Pick from results, then optionally `resolve_exercises` if you need UUIDs in bulk. |
| User asks how to perform a SPECIFIC named exercise ("how do I do a Romanian deadlift") | `resolve_exercises` (1-element batch) → `get_exercise_details(uuid)` | `resolve_exercises` gives you the UUID; `get_exercise_details` returns the full instructions / video / image blob. |
| Agent has a UUID and needs full instructions / media | `get_exercise_details` | Direct lookup by UUID. |

#### 3b. Update Pattern 3 — Exercise lookup → details

Replace the current code block (around lines 200-208) so the resolution step uses `resolve_exercises`:

```jsonc
// 1. Resolve the name to a UUID + metadata
resolve_exercises({ queries: ["romanian deadlift"] })
// → { results: [{ status: "matched", matches: [{ id: "<uuid>", weight_convention: "total", ... }] }] }

// 2. Pull full instructions / video for that UUID
get_exercise_details({ exercise_id: "<uuid>" })
```

Add a one-line note: *"For ambiguous names (`status: "ambiguous"`), present the alternates from `matches` to the user before calling `get_exercise_details`."*

#### 3c. Update Pattern 4 — Design + persist a new program

Rewrite step 2 of the Pattern 4 flow (around lines 213-217). The current text is:

> 2. Search exercises to resolve UUIDs (one `search_exercises` call per movement, narrow to single matches).
> 3. **For weighted exercises, pull `weight_convention` once** with `get_exercise_details` so the prescription weight you pass means the right thing per side vs total.

Replace with:

> 2. Resolve all exercise names to UUIDs in **one call** with `resolve_exercises({ queries: [...] })`. The response includes `weight_convention` for each exercise — no follow-up `get_exercise_details` calls needed before `create_program`. For any entry with `status: "ambiguous"`, present alternates to the user; for `status: "no_match"`, retry with a broader name or ask the user.

Step 3 (formerly the `get_exercise_details` step) is removed. Renumber subsequent steps.

#### 3d. Update both `update_program` worked examples (Patterns 2 and 3 in the "Common write patterns — `update_program`" section, around lines 366-449)

Wherever the example calls `search_exercises` per movement, collapse those into a single `resolve_exercises` call. Concrete edits:

- **Worked example 2 (add a Cardio day)** lines 376-379: replace the three `search_exercises` calls with `resolve_exercises({ queries: ["running", "jump rope", "plank"] })`.
- **Worked example 3 (swap an exercise)** line 416: replace `search_exercises({ query: "conventional deadlift" })` with `resolve_exercises({ queries: ["conventional deadlift"] })`.

Adjust the surrounding narration to match.

#### 3e. Update the Edge Cases table

Soften the row currently at line 478:

> | `search_exercises` returns multiple matches | **Do not pick blindly.** List them and ask the user. Only call `get_exercise_details` once a single match is selected. |

To:

> | `search_exercises` returns multiple matches | When BROWSING, list them and ask the user. **For program-building flows, prefer `resolve_exercises` — it returns alternates with `status: "ambiguous"` so you can disambiguate without a second call.** |

#### 3f. Inline version annotation

Following the existing convention (lines 110, 339), add a sentence near the new tool reference table row mentioning *"(since v0.5.0)"* — both in the tool-reference table description column and in the Pattern 4 narration where `resolve_exercises` first appears.

#### 3g. Remove the `### Server endpoint` count line consistency

Verify that the count line near line 66 ("Ten tools total — seven reads, two writes, one resolver" or whatever T98 set) matches the actual table after this PR. Adjust if needed.

## Out of Scope

- Removing `search_exercises` from the MCP toolkit (deferred per Epic Brief, ≥ 2-week observation window with concrete decision criteria).
- Removing `get_exercise_details` from the MCP toolkit (still needed for instructions / video / image use cases).
- Production instrumentation / metrics for tool-call counts (separate follow-up ticket).
- `LEGACY_MIGRATION_ERROR_MESSAGE` in `createProgramValidation.ts` — leave untouched (v0.2.x → v0.3.x migration text).
- `CHANGELOG.md` — does not exist in this repo; version annotations live inline in SKILL.md per the existing convention.
- New worked examples beyond the four listed above.

## Acceptance Criteria

- [ ] `tools/searchExercises.ts` description explicitly steers callers with names toward `resolve_exercises`
- [ ] `tools/createProgram.ts` `TOOL_DESCRIPTION` no longer instructs the agent to call `get_exercise_details` first for `weight_convention`; it points to `resolve_exercises` instead
- [ ] SKILL.md contains a "Catalog tools — which one when" decision table covering at minimum: build-program / browse-by-filter / single-exercise-instructions / UUID-direct-lookup intents
- [ ] SKILL.md Pattern 3 (single exercise lookup) uses `resolve_exercises` before `get_exercise_details`
- [ ] SKILL.md Pattern 4 (program design) uses a single `resolve_exercises` call to resolve all exercises and dropped the standalone `get_exercise_details` step for `weight_convention`
- [ ] Both `update_program` worked examples (add-day and swap-exercise) collapse per-movement `search_exercises` calls into a single `resolve_exercises` batch
- [ ] SKILL.md Edge Cases table acknowledges `resolve_exercises`'s `ambiguous` status as the program-building path for handling multi-match
- [ ] Tool count line in SKILL.md ("Ten tools total...") is consistent with the actual reference table
- [ ] Manual end-to-end smoke test against Claude Desktop: prompt *"build me a complete beginner weekly workout program with 3 sessions"* — Claude reaches for `resolve_exercises` (verified by counting tool calls in the conversation), program lands in ≤ 3 `create_program`-related calls (1 resolve + 1 dry_run + 1 apply)

## References

- [Epic Brief — MCP — Batch Exercise Resolution #310](./Epic_Brief_—_MCP_—_Batch_Exercise_Resolution_#310.md) — Stories 5, 6, 12; Critical Constraint #5 (SKILL.md / description coherence)
- [Tech Plan — MCP — Batch Exercise Resolution #310](./Tech_Plan_—_MCP_—_Batch_Exercise_Resolution_#310.md) — Modified Files table; Critical Constraint #5
- [T98 — `resolve_exercises` Tool End-to-End](./T98_—_resolve_exercises_Tool_End-to-End.md) (prerequisite)
- GitHub issue [#310](https://github.com/PierreTsia/workout-app/issues/310)
