# Epic Brief — MCP — update_program (#280)

## Summary

Ship the MCP `update_program` write tool — the third and final epic derived from #276 (Epic A `list_programs` / `get_program_details` shipped via #277, Epic B `create_program` prescription shipped via #279). `update_program` lets an AI assistant edit an existing program **in place by ID**: rename the program, add / remove / reorder / re-label days, swap exercises, and revise per-exercise prescription — all without recreating the program from scratch and without breaking the FK from `sessions.workout_day_id` to `workout_days.id` that ties historical training data to program structure.

The patch shape is **PATCH at the top level, declarative inside `days` when supplied**: `name?` and `days?` are both optional, but when `days` is provided it is treated as the full desired list (PUT-style) — days carry an optional `id` to preserve identity. This unblocks natural prompts like *"remplace RDL par soulevé de terre conventionnel et passe le bench à 4×8 @ 80kg"* — today the agent has no addressable edit surface and falls back to `create_program`, which orphans historical sessions and breaks program identity.

---

## Context & Problem

**Who is affected:** GymLogic users running an MCP-connected agent (Iris / OpenClaw, Claude Desktop, Le Chat, Cursor) for AI-assisted programming. Today the agent can list, read, and create programs (Epics A + B) but **cannot edit one in place** — every iteration requires a `create_program` call that drops historical session links and forces re-activation.

**Current state:**

- `create_program` (`file:supabase/functions/mcp/tools/createProgram.ts`) is the only program-write tool. It always inserts a new program and a fresh `workout_days` row tree — there's no surgical-edit surface.
- `get_program_details` (`file:supabase/functions/mcp/tools/getProgramDetails.ts`, Epic A) exposes the `workout_days.id` so days are addressable from the agent — but it surfaces `workout_exercises.id` (the slot PK) instead of `exercise_id` (the catalog UUID), so an agent doing a swap or even *preserving* an exercise has no addressable handle on the catalog item.
- `sessions.workout_day_id` references `workout_days(id)` with **no `ON DELETE` clause** (effectively `NO ACTION` — Postgres refuses to delete a `workout_days` row while sessions still point at it). Any "wipe and recreate" approach corrupts history or fails the FK.
- `set_logs.exercise_id` references `exercises(id)`, **not** `workout_exercises(id)` — so wiping and reinserting `workout_exercises` rows for a given day is safe (no FK to break, history stays attached to the catalog exercise).
- `cycles` has a partial unique index `one_active_cycle_per_program` on `(program_id, user_id) WHERE finished_at IS NULL` — so detecting a mid-cycle edit is a single `.eq("program_id", X).is("finished_at", null)` query.
- `programs` has a partial unique index `programs_active_unique` on `(user_id) WHERE is_active = true`. Any `is_active` toggling on `update_program` would conflict with the create-time activation logic — explicitly out of scope.
- `skills/gymlogic-mcp/SKILL.md` (post-Epic-B) advertises **8 tools** and still carries a stale line stating *"single-day editing is out of scope for MCP"* — Epic C invalidates that.

**Pain points:**


| Pain                                                                                                                          | Impact                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent has no in-place edit surface; iteration requires full program recreation                                                | Each prompt like *"swap RDL for conventional DL"* spawns a new program row, orphans historical sessions, breaks program identity, and forces re-activation |
| Agent cannot preserve an exercise across an edit (no addressable `exercise_id` in `get_program_details`)                      | Even a no-op edit forces the agent to `search_exercises` by name for every preserved exercise — fragile (name collisions, French-vs-English)               |
| Wipe-and-recreate would break the `sessions.workout_day_id` FK if the user has logged any session                             | Either a hard Postgres FK violation, or — if the FK were `CASCADE` — silent loss of historical training data                                               |
| No mid-cycle awareness on the write surface                                                                                   | An agent edit during an active cycle silently changes the user's remaining workouts in that cycle with no warning back to the user                         |
| Bulk destructive patches (agent hallucinates and re-sends the wrong structure) have no second-line guardrail beyond `dry_run` | A single confirmation flips an entire program structure, with no friction proportional to the destructiveness of the change                                |
| Validation logic for the prescription union (Epic B) lives only in `create_program`                                           | Without sharing, `update_program` either duplicates the validation or drifts                                                                               |


---

## User Stories

### Edit program metadata

1. As an **AI assistant**, I want to call `update_program` with `{ program_id, name: "Push Pull Legs v2" }` and nothing else, so that I can rename a program in a single round-trip without re-sending its full day structure.
2. As an **AI assistant**, when I omit `days` from the patch, I want the program's days to be left untouched, so that a metadata-only edit is unambiguous.

### Add / remove / reorder days

1. As an **AI assistant**, I want to add a new day by including an entry **without** an `id` in the `days[]` array, so that I can append "Cardio Light" to an existing 3-day split without re-creating the others.
2. As an **AI assistant**, I want to reorder days by changing their position in the `days[]` array, so that the resulting `sort_order` reflects the array order without me passing `sort_order` explicitly.
3. As an **AI assistant**, I want to remove a day by **omitting it** from the `days[]` array, so that I can drop "Saturday Cardio" from a program without sending an explicit delete op — provided no logged sessions reference it (see story 16).
4. As an **AI assistant**, I want to rename a day by including its `id` and a new `label` (and optionally a new `emoji`), so that "Lundi" becomes "Push" without breaking session history.

### Swap exercises and revise prescription

1. As an **AI assistant**, I want to call `get_program_details` and receive each exercise's catalog `exercise_id` (not just the `workout_exercises` slot id), so that I can construct an `update_program` patch that preserves an exercise without re-searching for it by name.
2. As an **AI assistant**, I want the `exercises[]` array per day in the patch to use the same union shape as Epic B (`string | { exercise_id, sets, reps, weight_kg, rest_seconds, target_duration_seconds? }`), so that I don't have to learn a second prescription syntax.
3. As an **AI assistant**, when I include an exercise object in the patch, I want **all prescription fields** to be required (sets, reps, weight_kg, rest_seconds + target_duration_seconds for duration exercises), so that I can't accidentally emit a half-baked prescription assuming the existing values will be merged.
4. As an **AI assistant**, when I send a day in the patch, I want every `workout_exercises` row of that day to be wiped and reinserted from the patch's `exercises[]` array, so that the day's prescription always exactly matches what I sent.

### Default safety: dry_run + confirm

1. As an **AI assistant**, when I call `update_program` without `dry_run: false`, I want the tool to default to a dry-run preview and not write anything, so that a typo or hallucinated patch never silently mutates the user's program.
2. As an **AI assistant**, I want the dry_run preview to return the **full program state as it would be after apply** (program metadata + days + exercises with resolved weight echoes), so that I can show the user exactly what they're about to commit.
3. As an **AI assistant**, I want the dry_run output to include auxiliary sections `removed_days[]` (each with `id`, `label`, `session_count`, `blocking`) and `added_days[]` and `warnings[]`, so that a destructive change is visible in addition to the final state.
4. As an **AI assistant**, when the patch removes one or more days, I want the apply to require an explicit `confirm: true` flag in addition to `dry_run: false`, so that a destructive patch can't be applied with the same call shape as a benign one.

### Hard guardrails (DB-enforced)

1. As an **AI assistant**, when I send a day with `id: "<unknown-uuid>"` (not part of this program), I want a clear validation error explicitly suggesting *"omit the id to create a new day"*, so that I don't accidentally update the wrong program.
2. As an **AI assistant**, when the patch removes a day that has logged sessions, I want a **structured error** naming the day, its session count, and the suggested remediation (*"rename or repurpose it instead"*), so that I never silently destroy historical data and so the agent can propose a working alternative to the user.
3. As an **AI assistant**, when I send the same day `id` twice in the `days[]` array, I want a clear error so I don't trigger an undefined update order.
4. As an **AI assistant**, when I send `days: []` (empty array) or a day with `exercises: []`, I want a validation error preserving the existing invariants (≥1 day per program, ≥1 exercise per day) — same rules as `create_program`.

### Mid-cycle awareness

1. As a **GymLogic user**, when an agent edits a program I'm currently in the middle of training (active cycle), I want the apply response to include a clear warning naming the active cycle, its `started_at` date, and stating *"this affects your remaining workouts in this cycle"*, so that I'm aware the change touches my live training.
2. As an **AI assistant**, I want the same mid-cycle warning to appear in the dry_run response, so that I can ask the user for explicit confirmation before applying a mid-cycle change.

### Failure transparency

1. As a **GymLogic user**, when an `update_program` apply fails partway through (e.g. transient DB error after day 1 succeeded), I want the response to enumerate which days were applied (`applied_days[]`), at which day the apply failed (`failed_at`), and which days were not attempted (`remaining_days[]`), so that I (or the agent) can resume cleanly without re-applying what already landed.

### Discoverability

1. As a **GymLogic user setting up Iris / Claude Desktop**, I want `skills/gymlogic-mcp/SKILL.md` to advertise the 9th tool `update_program` with at least 3 worked examples (rename only, add a day, swap an exercise + revise prescription), and to drop the legacy *"single-day editing is out of scope"* line, so that the agent picks up the right syntax zero-shot.

### Success measures


| Story # | Measure                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5, 16   | 100% of `update_program` applies leave `set_logs` and `sessions` untouched (verified via DB diff in E2E) — 0 rows mutated, deleted, or orphaned                                             |
| 7       | `exercise_id` (catalog UUID) is present in 100% of `get_program_details` responses, alongside or replacing the slot id                                                                      |
| 11      | `dry_run` defaults to `true` — verified by a test asserting that omitting both `dry_run` and `confirm` on a removal patch returns a preview with `removed_days[]` populated and 0 DB writes |
| 14      | A patch that removes ≥1 day with `dry_run: false` and `confirm: false` (or omitted) returns a structured error and 0 DB writes                                                              |
| 16      | A patch that removes a day with logged sessions returns the structured error in both dry_run and apply, regardless of `confirm: true`                                                       |
| 19, 20  | Mid-cycle update response (dry_run AND apply) carries a warning string naming the cycle and the *"affects your remaining workouts"* clause                                                  |
| 22      | `SKILL.md` advertises 9 tools and contains ≥3 worked `update_program` examples; the stale L188-style "single-day editing out of scope" line is removed                                      |


Other stories are validated qualitatively through the user story itself.

---

## Scope

**In scope:**

1. `**update_program` MCP tool** — new 9th tool, registered after `create_program` in the registry. Input schema:
  - `program_id: string` (required, UUID)
  - `name?: string` (optional rename)
  - `days?: Array<{ id?: string, label: string, emoji?: string, exercises: (string | { exercise_id, sets, reps, weight_kg, rest_seconds, target_duration_seconds? })[] }>` (optional; if provided, declarative full list)
  - `dry_run?: boolean` (default `true`)
  - `confirm?: boolean` (default `false`, required when patch removes ≥1 day)
2. **Day identity semantics** — day with `id` matching an existing day → UPDATE; day without `id` → INSERT; existing day absent from `days[]` → DELETE (with FK pre-check). Position in array = `sort_order`. Duplicate `id`s rejected.
3. **Exercise prescription shape** — strictly mirror `create_program` (Epic B union): bare-string UUID → defaults; object form requires ALL prescription fields. Validation primitives (`parseExerciseInput`, `validateExerciseCrossFields`, `parseRepsBounds`, `BOUNDS`) imported from `createProgramValidation.ts` as-is.
4. **Wipe-and-reinsert per touched day** — for each day present in the patch, all `workout_exercises` rows of that day are deleted and reinserted from the patch (safe: nothing references `workout_exercises.id`). Days absent from the patch are not touched.
5. `**get_program_details` extension** — replace `workout_exercises.id` with `exercise_id` in the returned markdown format and selected columns. The slot id (`workout_exercises.id`) is consumed nowhere downstream — verified during T1.
6. **FK pre-check for day deletion** — for each day being removed, count `sessions WHERE workout_day_id = X`. If `> 0`, return a structured error in both `dry_run` and apply: *"Cannot remove day '**' — it has N logged sessions. Rename or repurpose it instead."*
7. `**dry_run: true` default + structured output** — preview includes:
  - `program` (full state after apply)
  - `rendered` (markdown human-readable using `formatPrescriptionLine` / `formatWeightConvention`)
  - `removed_days[]` with `{ id, label, session_count, blocking }`
  - `added_days[]` with `{ label }`
  - `warnings[]` (mid-cycle warning string when applicable)
  - `errors[]` (FK violations, etc.) — non-empty `errors[]` returns `isError: true` and blocks apply
  - `note` ("Dry-run — set dry_run: false to apply.")
8. `**confirm: true` requirement on destructive patches** — when the patch removes ≥1 day, `dry_run: false` alone is rejected without `confirm: true`. Error message states the count of removed days and the required flag.
9. **Active-cycle warning** — query `cycles WHERE program_id = X AND finished_at IS NULL`. If a row exists, append a warning string to `warnings[]` in both dry_run and apply: *"Cycle actif depuis YYYY-MM-DD — cette modification affecte vos workouts restants dans ce cycle."*
10. **Per-day atomicity, partial-success report** — no cross-day rollback. If apply fails after day N succeeded, response includes `applied_days[]`, `failed_at: { day_label, error }`, `remaining_days[]`. All validation passes before the first DB write to minimize mid-flight failure causes (only transient infra issues should land here).
11. **Tool description + `SKILL.md` update** — advertise the 9th tool, drop the legacy *"single-day editing is out of scope"* line, add ≥3 worked examples (rename only, add a day, swap + revise prescription).
12. **Server version bump** — `SERVER_INFO.version` 0.3.x → 0.4.0 (additive: new tool + read-side `exercise_id` exposure; non-breaking for `create_program` callers).
13. **Edge / web parity for any new persistence helpers** — if `update_program` extracts a new helper into `programPersistence.ts`, the existing fixture pattern (`programPersistence_fixtures.json`, consumed by both Vitest and Deno) is extended.

**Out of scope:**

- **Optimistic locking / concurrent-edit detection** — last-write-wins. Documented limitation in tool description.
- `**is_active` toggling** — belongs to a future `set_active_program` tool. Partial unique index `programs_active_unique` would conflict with create-time activation logic.
- **Schema migrations** — no `ON DELETE CASCADE` on `sessions.workout_day_id`, no rename of `set_logs.exercise_id` to point at `workout_exercises`. Pre-check pattern handles the FK safely.
- **Per-set prescription overrides (drop sets, pyramid sets)** — schema is per-exercise; out of scope here as in Epic B.
- **Web/UI changes** — no changes to the in-app builder, AI generation flow, or any React component. MCP-server-only.
- **Renaming `createProgramValidation.ts` to `programValidation.ts`** — yak-shaving deferred. Imports happen as-is from the create-named module. If cohabitation becomes painful, rename in a follow-up.
- **Optional / partial prescription fields on the object form** — the combined tech plan (`docs/done/Tech_Plan_—_MCP_—_Read_&_Edit_Programs_#276.md`) suggested optional fields; explicitly rejected here for symmetry with `create_program` and to avoid the "merge with existing" semantics.
- `**force_delete: true` override** — no escape hatch for removing days with sessions. Rename / repurpose is the documented workaround.
- **Cross-day rollback / compensating snapshot** — partial-success report covers user-visible recovery; transactional safety would require either a Postgres RPC migration or a heavier compensating-with-snapshot pattern, neither of which the MVP needs.
- **Migration / backfill of programs created before Epic C** — `update_program` works on any existing program with stable `workout_days.id`; nothing to backfill.
- **Bulk-edit primitives** (e.g. *"add 5kg to every weight in this program"*) — outside the agent-driven, declarative-patch model. The agent computes the patch client-side from `get_program_details` if it wants this UX.

---

## Success Criteria

- **Numeric:** Across all `update_program` applies (dry-run + real) in the test suite, `set_logs` and `sessions` row counts are unchanged — verified via before/after `count(*)` snapshots in E2E.
- **Numeric:** A `dry_run: true` (or omitted) call returns 0 DB writes, verified by a counter on `supabase.from(...).insert/update/delete` invocations in unit tests of the handler.
- **Numeric:** A patch removing a day that has ≥1 session returns the structured FK error and produces 0 DB writes — verified in both dry_run and apply paths.
- **Numeric:** A patch removing ≥1 day with `dry_run: false` and `confirm` omitted (or `false`) returns the destructive-guard error and produces 0 DB writes.
- **Numeric:** A patch updating an existing day with new exercises produces a `workout_exercises` row count for that day matching `patch.days[i].exercises.length` exactly, and `set_logs.exercise_id` references for that day's historical sessions are unchanged.
- **Numeric:** `SERVER_INFO.version` is `0.4.0` and `tools/list` returns 9 tools including `update_program` immediately after `create_program`.
- **Numeric:** `get_program_details` response (markdown) contains each exercise's catalog `exercise_id` — verified in unit tests asserting on the rendered markdown shape.
- **Qualitative:** A French prompt *"remplace RDL par soulevé de terre conventionnel et passe le bench à 4×8 @ 80kg"* resolves to a single `update_program` apply (not a `create_program`), preserving program identity and historical sessions.
- **Qualitative:** A mid-cycle update response (dry_run AND apply) carries a visible warning naming the active cycle, its `started_at`, and the *"affects your remaining workouts"* clause.
- **Qualitative:** A partial-success path (simulated transient DB error after day 1 succeeded) returns a response carrying `applied_days[1 entry]`, `failed_at: { day_label: "<failed day>", error: "<message>" }`, `remaining_days[N entries]` — agent or user can resume from the partial state.
- **Qualitative:** `skills/gymlogic-mcp/SKILL.md` advertises 9 tools (rename / add-day / swap-exercise examples present), and the legacy *"single-day editing is out of scope"* line is removed.