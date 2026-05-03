# T75 — Special-Case Handling: Bodyweight + Duration

## Goal

Ship the two specialized branches of `create_program` that diverge from T74's standard "weighted reps with frozen ranges" path:

1. **Bodyweight exercises** always auto-derive `rep_range_min/max` and `set_range_min/max` (never freeze, even when explicit) so double progression keeps working — and reject any call passing `weight_kg > 0` on a bodyweight exercise (with a clear pointer to issue #281 for the deferred weighted-bodyweight case).
2. **Duration exercises** accept `target_duration_seconds`, reject mutually-exclusive fields (`reps`, `weight_kg`, `target_duration` on a reps exercise, etc.) with field-named errors, and persist with a duration-mode row layout.

Delivers user stories **8, 9, 10, 11** of the Epic Brief and completes user story **14** by adding the bodyweight pattern and the mixed reps/duration day example to the SKILL.md "Common write patterns" section.

After this ticket, an agent running *"fais-moi un push day complet : bench 4×8 @ 80kg, dips 4×12, plank 4×45s"* gets a program where every exercise type is honored correctly — weighted reps frozen, bodyweight auto-derived, duration with a target time stored.

## Mode

**AFK** — every decision is locked: bodyweight exception (always auto-derive), reject `weight_kg > 0` on bodyweight + reference issue #281, duration exclusivity rules, `target_duration_seconds` bounds 5-600, duration ranges auto-derived if not explicit.

## Slice (layers traversed)

`createProgram.ts` (4 cross-field validation rules added to T74's pipeline) → `programPersistence.ts` Edge + web mirror (bodyweight branch override + duration explicit branch in `buildWorkoutExerciseInsertRow`) → `programPersistence_fixtures.json` (new fixture cases for bodyweight + duration) → both test suites pick up the new cases automatically → `format.ts` `formatPrescriptionLine` extended with duration mode → SKILL.md "Common write patterns" gains bodyweight + mixed reps/duration day examples → manual E2E deliverables.

## Dependencies

- **T74** — provides the object form pipeline, the `parseRepsBounds` helper, the fixture-driven test infrastructure, the `formatPrescriptionLine` reps mode helper, and the validation pipeline structure that T75 plugs into. T75 cannot ship without T74's foundation.

## Scope

### Cross-field validation rules — `createProgram.ts` post-catalog-fetch

T74 establishes the validation order: `auth → legacy detection → shape → bounds → regex → catalog fetch → cross-field → build`. T75 extends the **cross-field** stage with these rules (each error must cite the day name + exercise position):

| Rule | Trigger | Error message hint |
|---|---|---|
| **R1: Bodyweight + non-zero weight** | Catalog says `equipment === "bodyweight"` AND `weight_kg > 0` | `"Bodyweight exercise '<name>' cannot have weight_kg > 0. For weighted variants (weighted dips, weighted pull-ups), see #281."` |
| **R2: Duration exercise + reps prescribed** | Catalog says `is_duration === true` AND `reps` is a non-zero string (i.e. not the default `"0"`) | `"Duration exercise '<name>' cannot have reps. Use target_duration_seconds instead."` |
| **R3: Duration exercise + non-zero weight** | Catalog says `is_duration === true` AND `weight_kg > 0` | `"Duration exercise '<name>' cannot have weight_kg. Set weight_kg to 0."` |
| **R4: Reps exercise + target_duration_seconds** | Catalog says `is_duration === false` AND `target_duration_seconds != null` | `"Reps exercise '<name>' cannot have target_duration_seconds. Use reps + weight_kg instead."` |
| **R5: Duration object form without target_duration_seconds** | Object form AND catalog says `is_duration === true` AND `target_duration_seconds === undefined` | `"Duration exercise '<name>' requires target_duration_seconds when prescribed explicitly. Use bare-string form to accept catalog defaults."` |

| Item | Detail |
|---|---|
| Position in validation pipeline | Immediately after catalog fetch, before `buildWorkoutExerciseInsertRow` (Tech Plan locked: cross-field rules need catalog data, can't run earlier) |
| Failure shape | Same `{ isError: true, content: [{ type: "text", text }] }` as T74's bounds errors |
| Atomicity | If ANY exercise fails any cross-field rule, the entire `create_program` call is rejected — no partial program created (Tech Plan locked behavior) |
| Bounds added by T75 | `target_duration_seconds` ∈ [5, 600] (T74 already declared the field in schema, T75 adds it to the bounds-validation step) |

### Persistence — bodyweight branch override in `buildWorkoutExerciseInsertRow` (Edge + web)

Add a branch BEFORE the T74 explicit-ranges branch:

```ts
if (isBodyweight) {
  // Always auto-derive ranges, even if repRangeMin/Max provided
  const { min: bMin, max: bMax } = parseRepsBounds(reps)
  return {
    // ... base fields ...
    reps,
    weight: "0",  // enforced
    rep_range_min: Math.max(1, bMin - 2),
    rep_range_max: bMax + 2,
    set_range_min: Math.max(1, sets - 1),
    set_range_max: sets + 2,
    max_weight_reached: true,  // existing bodyweight behavior preserved
  }
}
```

| Item | Detail |
|---|---|
| Detection | `equipment === "bodyweight"` from the catalog Map (passed into the helper or pre-computed by caller) |
| Override semantics | `repRangeMin/Max` and `setRangeMin/Max` from the input are IGNORED for bodyweight (Q3 lock: bodyweight always auto-derives to enable double progression) |
| `max_weight_reached: true` | Preserved from current behavior — bodyweight has no external load to add, so progression engine knows weight ceiling is hit |
| `weight` field | Forced to `"0"` regardless of input (R1 already rejected `weight_kg > 0`, but defensive) |
| Reps stored verbatim | `reps` field stored as-is (e.g. `"12"` or `"8-12"`) — same as T74 reps mode |

### Persistence — duration explicit branch in `buildWorkoutExerciseInsertRow` (Edge + web)

Add a branch BEFORE the T74 explicit-ranges branch (and before bodyweight, or after — order is by exclusivity, not chained):

```ts
if (isDuration && targetDurationSeconds != null) {
  return {
    // ... base fields ...
    reps: "0",
    weight: "0",
    target_duration_seconds: targetDurationSeconds,
    duration_range_min_seconds: targetDurationSeconds,  // freeze
    duration_range_max_seconds: targetDurationSeconds,  // freeze
    set_range_min: sets,
    set_range_max: sets,
  }
}
// Else (duration without explicit target — bare-string fallback): existing duration logic preserved
```

| Item | Detail |
|---|---|
| Detection | `is_duration === true` from the catalog Map |
| Freeze semantics | If `targetDurationSeconds` provided, both range bounds = the explicit value (consistent with reps-mode freeze in T74) |
| Bare-string duration fallback | If `targetDurationSeconds === undefined` AND bare-string form, keep current auto-derive behavior using catalog defaults (no behavior change for the legacy path) |
| `reps` field | Forced to `"0"` (duration exercises never have reps) |
| `weight` field | Forced to `"0"` (R3 already rejected, defensive) |

### Persistence type extension — `GeneratedExerciseForProgram` (already extended in T74)

T74 added `targetDurationSeconds?: number` to the type. T75 wires the persistence branch that consumes it. No new fields needed in T75.

### Format helper extension — `formatPrescriptionLine` duration mode

Extend the helper from T74 to handle the duration branch:

| Input shape | Output |
|---|---|
| `targetDurationSeconds: 45, reps: "0", weightKg: 0` | `"Plank — 4 × 45s — 60s rest"` |
| Reps mode (T74) | Unchanged: `"Bench Press — 4 × 8 × 80 kg total — 120s rest"` |

| Item | Detail |
|---|---|
| Branch condition | `if (input.targetDurationSeconds != null)` → render duration line |
| Tests | Add ≥2 cases to both Vitest and Deno test for `formatPrescriptionLine`: short plank (45s), longer hold (120s) |

### Shared fixtures — `programPersistence_fixtures.json` extension

Add new cases to the file created in T74:

| # | Case | Expected behavior |
|---|---|---|
| 10 | Bodyweight `pushup` with explicit `4×12` (object form, no weight) | Row with `reps="12", weight="0", rep_range_min=10, rep_range_max=14, set_range_min=3, set_range_max=6, max_weight_reached=true` (auto-derived, NOT frozen) |
| 11 | Bodyweight `pushup` with explicit `4×8-12` (double progression intent) | Row with `reps="8-12", rep_range_min=6, rep_range_max=14, set_range_min=3, set_range_max=6` (auto-derived from the explicit range) |
| 12 | Bodyweight `pushup` with bare-string form | Row with current legacy bodyweight behavior preserved (default sets/reps from catalog, auto-derived ranges) |
| 13 | Duration `plank` with explicit `4×45s` (object form, target_duration=45) | Row with `target_duration_seconds=45, duration_range_min/max_seconds=45/45, set_range_min=4, set_range_max=4` |
| 14 | Duration `plank` with bare-string form | Row with current legacy duration behavior preserved (catalog defaults, auto-derived ranges) |
| 15 | Mixed day: `bench 4×8 @ 80kg`, `pushup 4×12`, `plank 4×45s` | 3 rows, each in its correct mode (frozen reps, auto-derived bodyweight, frozen duration) |

### Skill doc update — `skills/gymlogic-mcp/SKILL.md` "Common write patterns" extension

T74 created the section with 2 examples. T75 appends 2 more:

| Pattern | Example call |
|---|---|
| **Bodyweight (auto-derive applies even with explicit prescription)** | `pushup 4×12` → row stored with `rep_range: 10/14`, NOT frozen at `12/12`. Note: `weight_kg > 0` is rejected with #281 reference. |
| **Mixed reps + duration day** | `bench 4×8 @ 80kg, plank 4×45s` → 2 rows, one frozen reps mode, one frozen duration mode. |

Each example shows:
- The agent prompt that resolves to the call
- The JSON sent to `create_program`
- The expected `rendered` echo (via `formatPrescriptionLine`)
- A 1-line note on the special semantic (auto-derive for bodyweight, target_duration for duration)

### Manual E2E deliverables (PR description, not code)

T75 extends the T74 PR description with additional deliverables:

| Deliverable | Detail |
|---|---|
| Claude Desktop test prompts | 4 additional prompts: bodyweight pushup explicit, bodyweight + weight rejection, duration plank explicit, mixed reps+duration day |
| Iris skill update snippet | Append the bodyweight + duration patterns to the snippet from T74 |
| SSH probe checklist (executed by agent) | (e) bodyweight call auto-derives ranges; (f) `weight_kg > 0` on bodyweight returns the #281-referenced error; (g) duration call freezes target_duration; (h) reps + target_duration cross-field reject; (i) duration object without target_duration cross-field reject |

## Out of Scope

- Weighted bodyweight support (weighted dips, weighted pull-ups, belt-loaded chins) — tracked in **#281**, deferred to a future epic. T75 only ships the rejection path with the issue reference.
- Adding new equipment types or modifying the `equipment` enum — out of scope for the entire epic.
- Any changes to the progression engine logic in `src/lib/progression.ts` — Tech Plan accepted the assumption that `min === max` is handled correctly; if a bug surfaces during E2E, open a separate issue.
- Per-set duration overrides (e.g. set 1 = 30s, set 2 = 45s) — Epic Brief out of scope.
- Drop sets, AMRAP, RPE-based prescriptions — Epic Brief out of scope.
- Backwards-compat with old programs that may have inconsistent duration data — Epic Brief out of scope, no migration.
- Web UI changes to consume the new branches — Epic Brief out of scope, web AI flow stays bare-string only.

## Acceptance Criteria

- [ ] Calling `create_program` with `weight_kg: 25` on a bodyweight exercise (e.g. pushup) returns an error containing the exercise name and the string `"#281"`
- [ ] Calling `create_program` with `target_duration_seconds: 30` on a reps exercise (e.g. bench press) returns an error citing the exercise name and the field `target_duration_seconds`
- [ ] Calling `create_program` with `reps: "8"` on a duration exercise (e.g. plank) returns an error citing the exercise name and the field `reps`
- [ ] Calling `create_program` in object form on a duration exercise WITHOUT `target_duration_seconds` returns an error citing the exercise name and the missing field
- [ ] Calling `create_program` with `pushup 4×12` (object form, no weight) inserts a row with `rep_range_min=10, rep_range_max=14, set_range_min=3, set_range_max=6, max_weight_reached=true, weight="0"` — the explicit `4×12` does NOT freeze ranges (bodyweight always auto-derives)
- [ ] Calling `create_program` with `pushup 4×8-12` (object form, double progression intent) inserts a row with `rep_range_min=6, rep_range_max=14, set_range_min=3, set_range_max=6` — auto-derived from the explicit range
- [ ] Calling `create_program` with `plank 4×45s` (object form, target_duration=45) inserts a row with `target_duration_seconds=45, duration_range_min_seconds=45, duration_range_max_seconds=45, set_range_min=4, set_range_max=4, reps="0", weight="0"`
- [ ] Calling `create_program` with a mixed-mode day (`bench 4×8 @ 80kg`, `pushup 4×12`, `plank 4×45s`) inserts 3 rows, each in its correct mode, in a single atomic transaction
- [ ] `target_duration_seconds < 5` or `> 600` returns a bounds error citing the exercise position
- [ ] `dry_run: true` for a duration exercise returns a `rendered` line like `"Plank — 4 × 45s — 60s rest"`
- [ ] `dry_run: true` for a bodyweight exercise returns a `rendered` line like `"Pushup — 4 × 12 (bodyweight) — 90s rest"` (no kg suffix)
- [ ] `programPersistence_fixtures.json` has ≥6 new cases (cases 10-15 above); all pass identically in Vitest and Deno
- [ ] `skills/gymlogic-mcp/SKILL.md` "Common write patterns" section has 4 examples total (2 from T74 + 2 from T75: bodyweight + mixed reps/duration day)
- [ ] PR description (extending T74's) contains the 4 additional Claude Desktop test prompts, the extended Iris skill snippet, and a checkbox list of completed SSH probes (e) through (i)
- [ ] No existing test in the repo regresses (`npm test` green; existing `deno test` suites green)
- [ ] Existing `src/lib/programPersistence.test.ts` Vitest assertions for the web AI flow path produce identical expected rows (web bare-string path bodyweight + duration cases unchanged)

## References

- Epic Brief: [`docs/Epic_Brief_—_MCP_—_create_program_Prescription_#276.md`](./Epic_Brief_—_MCP_—_create_program_Prescription_#276.md) — see user stories 8, 9, 10, 11 + bodyweight/mixed rows of story 14
- Tech Plan: [`docs/Tech_Plan_—_MCP_—_create_program_Prescription_#276.md`](./Tech_Plan_—_MCP_—_create_program_Prescription_#276.md) — see "Key Decisions" rows on bodyweight always auto-derive, weighted-bodyweight rejection, duration support; "Critical Constraints" on bodyweight `max_weight_reached` interaction; "Component Responsibilities" on `programPersistence.ts` branches; "Failure Mode Analysis" rows on bodyweight + weight, cross-field conflicts
- GitHub issue: [#276 — MCP: Read all programs without cycle + Edit existing programs](https://github.com/PierreTsia/workout-app/issues/276)
- Deferred edge case issue: [#281 — Weighted bodyweight exercises (weighted dips, pull-ups)](https://github.com/PierreTsia/workout-app/issues/281)
- Predecessor ticket: [`docs/T74_—_Breaking_Schema_+_Object_Form_Prescription.md`](./T74_—_Breaking_Schema_+_Object_Form_Prescription.md)
- Existing handler to extend: `file:supabase/functions/mcp/tools/createProgram.ts`
- Existing persistence module (Edge): `file:supabase/functions/mcp/lib/programPersistence.ts`
- Existing persistence module (web mirror): `file:src/lib/programPersistence.ts`
- Bodyweight exercise editor (UI reference for `max_weight_reached` semantics): `file:src/components/builder/ExerciseDetailEditor.tsx`
- Progression engine (assumption: handles `min === max` correctly): `file:src/lib/progression.ts`
- Skill doc to extend: `file:skills/gymlogic-mcp/SKILL.md`
