# Epic Brief — MCP — create_program Prescription (#276)

## Summary

Extend the MCP `create_program` tool so an AI assistant can prescribe **explicit `sets`, `reps`, `weight_kg`, `rest_seconds`, `target_duration_seconds` per exercise** — instead of being silently flattened to the current hardcoded `3 sets × 10 reps × 90s rest, weight=0` defaults. Also enrich `get_exercise_details` with a derived `weight_convention` field so agents resolve the per-equipment weight semantics deterministically before prescribing. This is **part 2 of 3 deriving from issue #276** (Epic A — Read Programs shipped via #277, Epic C — `update_program` tracked in #280).

This unblocks the natural agent prompt **"bench 4×8 @ 80kg, RDL 3×5 @ 100kg, plank 4×45s, 90s rest"** which today either silently drops the prescription or applies wrong values. It is a **breaking change** to the `create_program` input shape (drop `exercise_ids`, replace with a typed `exercises` union) — chosen over additive evolution because the tool was shipped <2 months ago with near-zero external usage and the legacy shape would otherwise become permanent technical debt.

---

## Context & Problem

**Who is affected:** GymLogic users running an MCP-connected agent (Iris/OpenClaw, Claude Desktop, Le Chat, Cursor) for AI-assisted programming. Today the AI cannot pass any prescription specifics through `create_program` — the tool was shipped with placeholder defaults pending this Epic.

**Current state:**

- `create_program` (`file:supabase/functions/mcp/tools/createProgram.ts`) accepts `days: [{ label, exercise_ids: string[] }]`. Every exercise lands in DB with `sets: 3, reps: "10", weight: "0", rest_seconds: 90, target_duration_seconds: catalog default or 30s`. Range fields auto-derived around those defaults.
- The in-app builder (`file:src/components/builder/ExerciseDetailEditor.tsx`) and the AI generation flow (`file:src/components/create-program/AIProgramPreviewStep.tsx`) both let users / AI specify per-exercise prescription. MCP is the only program-creation surface that doesn't.
- `get_exercise_details` (Epic A, `file:supabase/functions/mcp/tools/getExerciseDetails.ts`) returns `equipment` but no derived `weight_convention`. Agents must infer convention from `equipment` value via prior knowledge of `SKILL.md` — which zero-shot agents may not have loaded.
- `programPersistence.ts` (`file:supabase/functions/mcp/lib/programPersistence.ts` + web mirror at `file:src/lib/programPersistence.ts`) is the shared row-builder used by both MCP and the web AI flow. Its current contract has no notion of "explicit vs default" prescription.
- Per-equipment weight convention (per-hand for `dumbbell`/`kettlebell`, total for `barbell`/`machine`/`cable`/`ez_bar`/`plate-loaded`, `0` for `bodyweight`) is documented in `file:skills/gymlogic-mcp/SKILL.md` lines 132-165 — but **only for the read side** (`weight_logged`). The write side has no documented convention because there's currently no write surface that takes weight.
- `set_logs` weight ambiguity already burned us once in [#263](https://github.com/PierreTsia/workout-app/issues/263); shipping an ambiguous write surface for `weight_kg` would replicate that bug.

**Pain points:**

| Pain | Impact |
|---|---|
| Agent cannot translate "bench 4×8 @ 80kg" into a real prescription | Prompt resolves to silent `3×10 @ 0kg`, user opens app and has to edit every exercise manually |
| Agent cannot prescribe duration for plank-style exercises | "plank 4×45s" silently becomes "plank 4 sets × catalog default duration" with `reps: "0"` regardless of what the agent passed |
| Per-equipment weight convention is implicit and undocumented for writes | An agent writing `weight_kg: 25` for "DB curl" might mean per-hand (correct) or total (wrong) — same bug class as #263 |
| `create_program` schema is locked into placeholder semantics | Every future write tool (Epic C `update_program`, future `replace_day_exercises`) inherits the wrong shape if we don't fix it now |
| Agent has no addressable way to differentiate linear progression ("bench 4×8") from double progression ("bench 4×8-12") in the prescription | All prescriptions get the same auto-derived ranges regardless of intent |

---

## User Stories

### Prescribe with explicit sets / reps / weight

1. As an **AI assistant**, I want to pass `{ exercise_id, sets, reps, weight_kg, rest_seconds }` for each exercise in a day, so that the user opens GymLogic and finds exactly the prescription I told them I'd create.
2. As an **AI assistant**, I want to pass `reps: "8"` and have the program engine treat it as a fixed target (linear progression: weight goes up, reps stay at 8), so that a user training Starting Strength gets the expected behavior.
3. As an **AI assistant**, I want to pass `reps: "8-12"` and have the program engine treat it as a double-progression range (reps progress 8 → 12, then weight up and reset), so that a user training hypertrophy gets the expected behavior.
4. As an **AI assistant**, when I pass an exercise as a bare UUID string instead of an object, I want the tool to apply the current defaults (`3 sets × 10 reps × 90s rest, weight=0`), so that I don't have to invent values when the user only said "add a bench day".
5. As an **AI assistant**, when I pass an exercise as an object, I want the schema to require ALL prescription fields (`sets`, `reps`, `weight_kg`, `rest_seconds` + `target_duration_seconds` if duration), so that I can't silently emit a half-baked prescription that the user thinks is complete.

### Get the weight convention right

6. As an **AI assistant**, I want `get_exercise_details` to return a derived `weight_convention: "per_hand" | "total" | "bodyweight"` field, so that I know without ambiguity what `weight_kg: 25` means for this specific exercise.
7. As an **AI assistant**, I want the dry_run preview of `create_program` to echo the resolved weight in human form (*"DB Curl — 4 × 10 × 25 kg per hand (50 kg total per rep)"*) so that the user can spot a per-hand vs total mistake before applying.
8. As an **AI assistant**, when I try to pass `weight_kg > 0` for an exercise where `equipment === "bodyweight"`, I want a clear error explaining the limitation and pointing me at issue #281 for future weighted-bodyweight support.

### Handle duration exercises

9. As an **AI assistant**, I want to pass `target_duration_seconds: 45` for a plank-style exercise (`measurement_type === "duration"`), so that the user's prescription says "4×45s" instead of the catalog default.
10. As an **AI assistant**, when I pass `reps` or `weight_kg` for a duration exercise, I want a clear error so I don't accidentally cross-pollute prescription semantics.
11. As an **AI assistant**, when I pass `target_duration_seconds` for a reps exercise, I want a clear error so I don't accidentally store a duration on a reps row.

### Backwards-incompat handling

12. As an **AI assistant** that was built against the v0.2.0 `create_program` schema, when I call with the legacy `exercise_ids: [...]` shape, I want an error response that explicitly names the new shape (`exercises: ['uuid', ...]` or `exercises: [{...}, ...]`) and the minimum required server version (`0.3.0`), so that I can migrate my call site without guesswork.

### Discoverability

13. As a **GymLogic user**, I want my MCP-connected client to pick the right prescription syntax zero-shot from a natural-language prompt ("bench 4×8 @ 80kg" → linear; "bench 4×8-12 @ 80kg" → double progression), without me having to coach the agent.
14. As a **GymLogic user setting up Claude Desktop / Iris for the first time**, I want `SKILL.md` to include 4-5 worked examples (linear vs double progression, mixed reps/duration days, dumbbell vs barbell weight) that the agent loads as context, so that prompts like "create me a 4-day push/pull/legs/full" work without me coaching.

### Success measures

| Story # | Measure |
|---|---|
| 1 | 100% of fields passed in object form land in the corresponding `workout_exercises` row (verified via DB diff in E2E) |
| 2-3 | The `rep_range_min/max` and `set_range_min/max` columns reflect the agent's intent: `"8"` → `8/8`, `"8-12"` → `8/12`. Not the auto-derived `±2` formula. |
| 6 | `weight_convention` is present in 100% of `get_exercise_details` responses and matches the equipment-derived value (`"per_hand"` for `dumbbell`/`kettlebell`, `"bodyweight"` for `bodyweight`, `"total"` for everything else) |
| 13 | Both example prompts ("bench 4×8 @ 80kg, RDL 3×5 @ 100kg" linear; "DB curl 4×8-12 @ 15kg per hand" double) resolve correctly **zero-shot** in Iris and Claude Desktop during manual validation |
| 14 | `SKILL.md` contains at least 4 worked examples covering: linear progression weighted, double progression weighted, mixed reps/duration day, dumbbell weight (per-hand) |

Other stories are validated qualitatively through the user story itself.

---

## Scope

**In scope:**

1. **Breaking change to `create_program` input schema** — drop `exercise_ids: string[]`, replace with `exercises: (string | { exercise_id, sets, reps, weight_kg, rest_seconds, target_duration_seconds? })[]`. The **string form** (bare UUID) is preserved as the lazy path that applies current defaults (`3 sets × 10 reps × 90s rest, weight=0`). The **object form** requires ALL prescription fields except `target_duration_seconds` (which is required for duration exercises, rejected for reps exercises). `MAX_DAYS = 14`, `MAX_EXERCISES_PER_DAY = 40` preserved.
2. **`reps` format** — accept `/^\d+$/` (single integer, linear progression) or `/^\d+-\d+$/` (range, double progression). Reject `"AMRAP"`, `"MAX"`, `"failure"`, `"5+"`, etc. with clear error.
3. **Range field semantics** — when explicit prescription is passed for a non-bodyweight exercise, freeze `rep_range_min/max` and `set_range_min/max` to the agent's specified values (linear progression mode for `"8"` form, bounded double progression for `"8-12"` form). For bodyweight exercises, ALWAYS auto-derive ranges (`±2 reps, ±1/+2 sets`) regardless of explicit prescription, to preserve the double progression that the bodyweight `max_weight_reached: true` semantics rely on.
4. **`target_duration_seconds`** — accepted on duration exercises only, rejected on reps exercises. `weight_kg`/`reps` rejected on duration exercises.
5. **Bodyweight + `weight_kg > 0`** — rejected outright with explicit error pointing at #281. Agent gets a clear migration path (and a clear "not your fault" signal).
6. **`get_exercise_details` enrichment** — add a derived `weight_convention: "per_hand" | "total" | "bodyweight"` field to the response payload. Pure derivation from `equipment` (no DB column, no migration). Tool description references this field as the source of truth for `weight_kg` semantics on write.
7. **Dry_run preview echo** — the `create_program` dry_run output renders each prescribed exercise in human-readable form including the resolved weight convention (e.g. *"4 × 10 × 25 kg per hand (50 kg total per rep)"* for dumbbell, *"4 × 8 × 80 kg total"* for barbell, *"4 × 12 (bodyweight)"* for pushup).
8. **`SKILL.md` update** — add 4-5 worked examples of write-side prescription patterns (linear, double progression, mixed reps/duration day, dumbbell, bodyweight rejection). Surgical patches to existing sections + new "Common write patterns" section. Update the `create_program` tool roster entry.
9. **Server version bump** — `SERVER_INFO.version` 0.2.0 → 0.3.0 (breaking change tolerated on 0.x minor per semver pre-release rules; major bump deferred until Epic C ships and the contract is fully stable).
10. **Edge/web parity for `programPersistence.ts`** — extract shared test fixtures into `supabase/functions/mcp/lib/programPersistence_fixtures.json`, consumed by both Vitest and Deno test runners. All new behaviors (freeze, bodyweight exception, range syntax, duration prescription) covered by fixture cases. Single PR delivery.
11. **Backwards-incompat error message** — when an agent calls with the legacy `exercise_ids` shape, return a structured error naming the new shape AND the new minimum supported server version, so the migration path is self-documenting.

**Out of scope:**

- `update_program` — Epic C, tracked in [#280](https://github.com/PierreTsia/workout-app/issues/280).
- Weighted bodyweight exercises (weighted dips, weighted pullups, weight-vest pushups) — tracked in [#281](https://github.com/PierreTsia/workout-app/issues/281). Epic B explicitly rejects these to keep the simple contract.
- Any change to `set_logs` weight convention or `weight_logged` storage. Reads are untouched.
- Per-set prescription overrides (e.g. drop sets, pyramid sets) — current schema is per-exercise.
- Allowing the agent to pass `set_range_min/max` or `rep_range_min/max` directly. Agent specifies `sets`/`reps`; range semantics are computed deterministically from those + the bodyweight check.
- Weight unit conversion (lbs/kg). All MCP weight values are kg by convention.
- Migration / backfill of existing programs created via the old `create_program` shape. Only inserts going forward are affected; existing rows in DB are untouched.
- Deprecation period or transitional acceptance of both shapes in parallel. We chose pure breaking with a clear migration error message.
- Atomicity / rollback redesign — the existing compensating-rollback pattern in `createProgram.ts` is reused as-is.
- Integration of explicit prescription into the in-app web AI generation flow — `AIProgramPreviewStep` continues to call `programPersistence` with default-only generation. The persistence layer extension is additive and backwards-compatible for the web caller.
- Adding `weight_convention` to the in-app builder UI. Read-side surface for the UI is untouched.

---

## Success Criteria

- **Numeric:** A `create_program` call with explicit prescription `{ exercise_id, sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120 }` produces a `workout_exercises` row matching those values exactly + `rep_range: 8/8, set_range: 4/4` (frozen).
- **Numeric:** The same call with `reps: "8-12"` produces `rep_range: 8/12` (double progression bounds) and the prescription's `reps` column equals `"8-12"`.
- **Numeric:** A bare-string call `"<uuid>"` produces a row with the legacy defaults (`3/10/90s/0`) and the auto-derived ranges (`8-12 reps, 2-5 sets`) — backwards-compat for the lazy path.
- **Numeric:** A bodyweight exercise with `{ exercise_id, sets: 4, reps: "12", weight_kg: 0, rest_seconds: 60 }` produces ranges `rep_range: 10/14, set_range: 3/6` (auto-derived per the bodyweight exception, NOT frozen).
- **Numeric:** `weight_convention` is present in 100% of `get_exercise_details` responses and matches the equipment-derived value: `"per_hand"` for `dumbbell`/`kettlebell`, `"bodyweight"` for `bodyweight`, `"total"` for everything else.
- **Numeric:** Volume math parity — `create_program` for a dumbbell exercise with `weight_kg: 25, sets: 4, reps: "10"` produces a row whose volume math (`weight × 2 × reps × sets = 2000 kg`) matches a `set_logs` row at `weight_logged: 25` for the same exercise (per-equipment convention preserved end-to-end).
- **Numeric:** Calling `create_program` with the legacy `exercise_ids` shape returns an error whose body contains both the new schema example AND the string `0.3.0` (minimum supported version self-documented).
- **Numeric:** All test fixture cases pass identically in both Vitest (`programPersistence.test.ts`) and Deno test (`programPersistence_test.ts`) runners. Adding a new behavior to `programPersistence` requires adding a fixture case (enforced via PR description checklist).
- **Qualitative:** A French prompt *"bench 4×8 @ 80kg, RDL 3×5 @ 100kg, plank 4×45s, 90s repos"* produces a single `create_program` call with the correct mix of explicit reps prescription, explicit duration prescription, and resolved-convention weight echo in the dry_run preview.
- **Qualitative:** A French prompt *"DB curl 4×8-12 @ 15kg per hand"* produces a `create_program` call with `reps: "8-12"` (double progression), and the dry_run echo says *"4 × 8-12 × 15 kg per hand (30 kg total per rep)"* before the user confirms.
- **Qualitative:** Cross-field rejections (weight on bodyweight, reps on duration, target_duration on reps) all return errors that name the rule and the offending exercise — agent can fix without guessing.
- **Qualitative:** `SKILL.md` contains the 4-5 worked examples; both Iris and Claude Desktop resolve at least the two prompt examples above zero-shot during manual E2E.
