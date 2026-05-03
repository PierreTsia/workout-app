# T82 — SKILL.md Update + Manual E2E

## Goal

Make `update_program` discoverable to MCP-connected agents (Iris, Claude Desktop, Le Chat, Cursor) by updating `skills/gymlogic-mcp/SKILL.md` with a precise tool roster entry, three worked French examples, and removal of the legacy stale "single-day editing is out of scope" line. Validate end-to-end by running each example through Iris (or Claude Desktop) and confirming zero-shot resolution to the right `update_program` shape.

Cites Epic Brief stories: **#22 (SKILL.md advertises 9 tools, ≥3 worked examples, drops the L334-338 stale line)**. Indirectly validates the qualitative success criteria of the Epic ("a French prompt resolves to a single `update_program` apply").

## Mode

**HITL.** The SKILL.md patches themselves are mechanical, but the manual E2E phase requires a human:

- Tap each of the 3 reference prompts in Iris (and ideally Claude Desktop)
- Inspect the agent's chosen tool call shape
- Judge whether the wording in SKILL.md is vivid enough to guide the agent zero-shot — this is editorial judgement (an AI agent cannot self-validate its own discoverability)
- Iterate the wording if any prompt fails to resolve

## Slice

`skills/gymlogic-mcp/SKILL.md` (surgical patches in 3 places) → manual E2E with Iris/Claude Desktop → PR description includes screenshots / transcripts of the 3 prompts resolving correctly.

This is the ticket where the qualitative success criteria of Epic C are observed: *"A French prompt 'remplace RDL par soulevé de terre conventionnel et passe le bench à 4×8 @ 80kg' resolves to a single `update_program` apply."*

## Dependencies

**Hard dep on T81** — the `update_program` tool must exist and be deployed (or runnable locally against a test Supabase) for the manual E2E to make sense.

## Scope

### Three SKILL.md patches

#### Patch A — bump tool count in roster header

Search the section that says "GymLogic MCP exposes **eight tools**" (or similar — current wording post-Epic-B). Replace with **nine tools**. Update any auxiliary count references in the same section.

#### Patch B — add `update_program` row to tool roster

Insert immediately AFTER the `create_program` row in the existing tool roster table. Format follows the pattern of the existing rows.

Suggested entry:

```markdown
| `update_program` | Edit an existing program in place by id — rename, add / remove / reorder / re-label days, swap exercises, revise per-exercise prescription. Patch shape: PATCH at top-level (`name?`, `days?`); inside `days`, declarative full-list with optional `id` per day (id present → UPDATE, id absent → INSERT, omitted current day → DELETE). `dry_run: true` by default; pass `confirm: true` along with `dry_run: false` when removing days. Mid-cycle updates surface a warning. Atomicity is per-day — partial-success report on failure. |
```

#### Patch C — drop the legacy "single-day editing is out of scope" line

Locate lines L334-338 (or wherever the stale line lives post-Epic-B; the Tech Plan referenced lines 334-338). The line reads roughly:

> *"User asks to modify one day of an existing program → Out of scope for MCP — create_program replaces the whole program"*

Replace this entire bullet with the new pattern guidance:

> *"User asks to modify one day, swap an exercise, or rename a program → use `update_program` (NEVER `create_program` — that would orphan training history)."*

(Adjust the exact wording to match the surrounding bullet style.)

#### Patch D — add new "Common write patterns: update_program" section

New sub-section, placed AFTER the existing Epic-B "Common write patterns" section (the one with `create_program` examples). Keep ≥3 worked French examples to maximize zero-shot value.

**Example 1 — rename only**:

> Prompt: *"renomme mon programme PPL en 'PPL v2'"*
>
> Resolution: single `update_program` call.
>
> ```json
> {
>   "program_id": "<from list_programs>",
>   "name": "PPL v2",
>   "dry_run": false
> }
> ```
>
> Expected response: `{ "applied_days": [], "failed_at": null, "message": "Updated 0 day(s)." }` (rename succeeded; no day ops).

**Example 2 — add a day**:

> Prompt: *"ajoute une journée Cardio à mon programme PPL avec 3 exos: course 4×30s, jump rope 4×60s, plank 4×45s"*
>
> Resolution: agent must fetch program details first (to get current days' ids), then send a patch with all current days (preserved by id) + 1 new day:
>
> ```json
> {
>   "program_id": "<from list_programs>",
>   "days": [
>     { "id": "<push day id>", "label": "Push", "exercises": [...same exercises as before, with exercise_id values...] },
>     { "id": "<pull day id>", "label": "Pull", "exercises": [...] },
>     { "id": "<legs day id>", "label": "Legs", "exercises": [...] },
>     { "label": "Cardio", "emoji": "🏃", "exercises": [
>       { "exercise_id": "<run uuid>", "sets": 4, "reps": "0", "weight_kg": 0, "rest_seconds": 60, "target_duration_seconds": 30 },
>       { "exercise_id": "<jump rope uuid>", "sets": 4, "reps": "0", "weight_kg": 0, "rest_seconds": 60, "target_duration_seconds": 60 },
>       { "exercise_id": "<plank uuid>", "sets": 4, "reps": "0", "weight_kg": 0, "rest_seconds": 60, "target_duration_seconds": 45 }
>     ]}
>   ],
>   "dry_run": false
> }
> ```
>
> Note: the agent uses bare-string form for any day's exercises that don't change to keep the payload concise — but here the new Cardio day uses object form because we're prescribing duration explicitly.

**Example 3 — swap an exercise + revise prescription**:

> Prompt: *"remplace RDL par soulevé de terre conventionnel et passe le bench à 4×8 @ 80kg"*
>
> Resolution: agent fetches program details, identifies the day(s) containing RDL and the day containing bench. Sends a patch updating ONLY those days (others omitted from `days[]` → leave unchanged). Wait — that's wrong: omitting days from `days[]` triggers DELETE. Correct pattern: include ALL current days, modify the affected ones.
>
> ```json
> {
>   "program_id": "<from list_programs>",
>   "days": [
>     { "id": "<push day id>", "label": "Push", "exercises": [
>       "<warmup exercise_id>",
>       { "exercise_id": "<bench uuid>", "sets": 4, "reps": "8", "weight_kg": 80, "rest_seconds": 120 },
>       "<accessory exercise_id>"
>     ]},
>     { "id": "<pull day id>", "label": "Pull", "exercises": [
>       { "exercise_id": "<conventional deadlift uuid>", "sets": 3, "reps": "5", "weight_kg": 100, "rest_seconds": 180 },
>       "<other pull exercise_id>"
>     ]},
>     { "id": "<legs day id>", "label": "Legs", "exercises": ["<legs exercise_id>"] }
>   ],
>   "dry_run": false
> }
> ```
>
> Note: this preserves the program's identity AND the historical sessions — `create_program` would have orphaned them.

### Manual E2E acceptance

For each of the 3 reference prompts above:

1. Open Iris (or Claude Desktop) connected to the GymLogic MCP server (against a test Supabase with a non-empty PPL-shaped program).
2. Type the French prompt verbatim.
3. Observe the tool call(s) the agent makes.
4. **Required**: the agent calls `update_program` (not `create_program`).
5. **Required**: the call shape matches the documented schema (the agent fetches `get_program_details` first if needed for ids).
6. **Required**: the response is non-error (or, if `dry_run: true` is the agent's first call, a clean preview).
7. Capture screenshots / paste transcripts in the PR description.

If any prompt fails to resolve:
- Iterate the SKILL.md wording (typically: clearer naming, more vivid example, additional explicit hint about preserving days).
- Re-test.
- Loop until all 3 succeed OR escalate as a Tech Plan issue if a structural blocker emerges.

## Out of Scope

- Code changes (the handler is T81).
- Adding worked examples for >3 prompts (e.g. mid-cycle, destructive with confirm, partial-success retry). If the 3 above are insufficient for zero-shot resolution, that's a SKILL.md content gap to address in this ticket; if they're sufficient, additional examples can land later as discovered needs.
- Updating any other tool's SKILL.md entry beyond the surgical patches listed.
- Translating the examples to English (current SKILL.md is bilingual; French primary).
- Generating images / videos for the SKILL.md.

## Acceptance Criteria

- [ ] SKILL.md tool roster header says "**nine tools**" (or equivalent — exact wording matches surrounding style).
- [ ] SKILL.md contains an `update_program` row in the tool roster table, placed immediately after `create_program`.
- [ ] The legacy line at L334-338 (*"single-day editing is out of scope"*) is removed; replaced with a positive pointer to `update_program`.
- [ ] SKILL.md contains a new sub-section with ≥3 worked `update_program` examples covering: rename only, add a day, swap exercise + revise prescription. Each example shows the prompt AND the JSON tool call shape AND the expected response shape.
- [ ] **Manual E2E #1**: prompt *"renomme mon programme PPL en 'PPL v2'"* resolves to a single `update_program` call in Iris (transcript / screenshot in PR).
- [ ] **Manual E2E #2**: prompt *"ajoute une journée Cardio à mon programme PPL avec 3 exos: course 4×30s, jump rope 4×60s, plank 4×45s"* resolves to a single `update_program` call (with prior `get_program_details` for ids) in Iris.
- [ ] **Manual E2E #3**: prompt *"remplace RDL par soulevé de terre conventionnel et passe le bench à 4×8 @ 80kg"* resolves to a single `update_program` call (NOT `create_program`) preserving program identity in Iris.
- [ ] PR description includes a verbatim transcript or screenshots of all 3 E2E sessions.

## References

- Epic Brief: `file:docs/Epic_Brief_—_MCP_—_update_program_#280.md` (Story 22)
- Tech Plan: `file:docs/Tech_Plan_—_MCP_—_update_program_#280.md` (`SKILL.md` updates Key Decision; T7 in Implementation Sequence)
- Modified file: `file:skills/gymlogic-mcp/SKILL.md`
