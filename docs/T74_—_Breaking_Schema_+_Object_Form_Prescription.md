# T74 — Breaking Schema + Object Form Prescription (Weighted Reps)

## Goal

Ship the **breaking change** to `create_program`'s input contract AND the full object form prescription pathway for non-bodyweight, non-duration reps exercises. After this ticket an agent can call `create_program` with explicit `sets`, `reps` (`"8"` or `"8-12"`), `weight_kg`, and `rest_seconds` per exercise — and the row hits Supabase with frozen progression ranges that match the agent's intent. The `dry_run` mode echoes back human-readable lines like `Bench Press — 4 × 8 × 80 kg total — 120s rest` so the agent can verify before applying.

Delivers user stories **1, 2, 3, 4, 5, 7, 12, 13** of the Epic Brief, plus the linear and double progression examples in story **14**.

This is the foundation of Epic B. After T74, an agent running *"crée-moi un push day : bench 4×8 @ 80kg, OHP 4×6 @ 50kg, dumbbell row 4×10 @ 25kg per hand, 120s repos"* gets a program where every prescription is honored exactly — no more silent default-fallback to `3×10 @ 0kg`.

## Mode

**AFK** — every decision is locked: union schema (string | object), all-required object form, `min === max` freeze for explicit ranges, regex `/^\d+(-\d+)?$/` for reps, `0.3.0` version bump, single PR, no deprecation period, validation order shape→bounds→regex→catalog→cross-field→build.

## Slice (layers traversed)

`createProgram.ts` (input parsing + bounds validation + regex + cross-field for reps mode + dry_run echo wiring + tool description rewrite) → `programPersistence.ts` Edge + web mirror (new `parseRepsBounds` helper + non-bodyweight explicit-ranges branch in `buildWorkoutExerciseInsertRow`) → `programPersistence_fixtures.json` (new shared file with legacy + new cases) → both test files refactored to load fixtures + new fixture cases assertions → `format.ts` (new `formatPrescriptionLine` helper) → `index.ts` version bump 0.2.0 → 0.3.0 → SKILL.md "Common write patterns" linear + double examples → manual E2E deliverables.

## Dependencies

- **T73** — provides `formatWeightConvention` consumed by `formatPrescriptionLine` in this ticket. T74 cannot build the dry_run echo without T73's helper.

## Scope

### Server version bump — `supabase/functions/mcp/index.ts`

| Item | Detail |
|---|---|
| Change | `SERVER_INFO.version` from `"0.2.0"` to `"0.3.0"` |
| Rationale | Pre-1.0 minor bump per SemVer for breaking input contract change to a single tool |
| Verification | `tools/list` response shows `serverInfo.version === "0.3.0"` |

### Input schema rewrite — `createProgram.ts` `inputSchema`

Drop `exercise_ids` entirely. Replace with `exercises` field accepting a JSON Schema `oneOf` of `string` (bare UUID) or `object` (full prescription). The day shape becomes:

```ts
{
  name: string  // existing
  exercises: (string | {
    exercise_id: string
    sets: number       // 1 .. 10
    reps: string       // "N" or "N-M", regex /^\d+(-\d+)?$/
    weight_kg: number  // 0 .. 500
    rest_seconds: number  // 0 .. 600
    target_duration_seconds?: number  // 5 .. 600, optional, T75 wires the rules
  })[]
}
```

| Item | Detail |
|---|---|
| `exercise_ids` removal | Field is fully dropped from `inputSchema` |
| Object form completeness | `sets`, `reps`, `weight_kg`, `rest_seconds` all `required` (all-or-nothing per Q6 lock) |
| `target_duration_seconds` | Optional in schema; T75 enforces the cross-field rules |
| Schema description | Each field gets a one-line description with bounds (e.g. `"reps: 'N' (e.g. '8') for linear or 'N-M' (e.g. '8-12') for double progression"`) |

### Validation pipeline — `createProgram.ts` handler

Validation order is mandatory (Tech Plan locked):

1. **Auth gate** (existing) — return `"Authentication required..."` if no `supabase`
2. **Legacy input detection** — if input contains `exercise_ids` at the day level, return migration error (see below)
3. **Shape validation** — JSON Schema layer rejects malformed input
4. **Bounds validation** — sets/reps/weight/rest/target_duration out-of-range → field-named error
5. **Regex validation** — `reps` matches `/^\d+(-\d+)?$/`, else field-named error citing the exercise position
6. **Catalog fetch** — load exercises by ID into a `Map<id, ExerciseRow>` for cross-field rules and persistence
7. **Cross-field rules (reps mode only in T74)** — if object form has explicit `target_duration_seconds` AND exercise is reps mode → reject (T75 adds the rest of the cross-field rules)
8. **Build** — call `buildWorkoutExerciseInsertRow` per exercise, then bulk insert
9. **Dry_run** — if `dry_run: true`, skip insert and return preview with `rendered: string[]` per day

### Migration error message — `createProgram.ts`

When legacy `exercise_ids` is detected at the day level:

```
create_program v0.3.0 introduced a breaking change to the input shape.

The `exercise_ids` field has been replaced by `exercises`, which accepts
either a bare UUID string (defaults applied) or a full prescription object.

Old:
  { "name": "Push", "exercise_ids": ["uuid-1", "uuid-2"] }

New (bare UUID — same behavior as before):
  { "name": "Push", "exercises": ["uuid-1", "uuid-2"] }

New (explicit prescription):
  { "name": "Push", "exercises": [
    { "exercise_id": "uuid-1", "sets": 4, "reps": "8", "weight_kg": 80, "rest_seconds": 120 }
  ]}

See get_exercise_details for weight_convention guidance.
```

| Item | Detail |
|---|---|
| Return shape | `{ isError: true, content: [{ type: "text", text: <message> }] }` |
| Detection point | Top of handler, before any other validation, scanning the parsed input for `exercise_ids` keys at any day position |

### Persistence helper — `parseRepsBounds` in `programPersistence.ts` (Edge + web)

New pure helper, mirrored byte-for-byte between Edge and web:

```ts
export function parseRepsBounds(reps: string): { min: number; max: number } {
  const match = reps.match(/^(\d+)(?:-(\d+))?$/)
  if (!match) {
    throw new Error(`Invalid reps format: "${reps}". Expected "N" or "N-M".`)
  }
  const min = parseInt(match[1], 10)
  const max = match[2] ? parseInt(match[2], 10) : min
  if (max < min) {
    throw new Error(`Invalid reps range: "${reps}". Max (${max}) < min (${min}).`)
  }
  return { min, max }
}
```

| Item | Detail |
|---|---|
| Location | `supabase/functions/mcp/lib/programPersistence.ts` (Edge) AND `src/lib/programPersistence.ts` (web mirror) |
| Export | Named export, used by `buildWorkoutExerciseInsertRow` and indirectly by `createProgram.ts` for dry_run echo |
| Note | The `current` reps field stored in DB (`workout_exercises.reps`) remains the agent-provided string verbatim (e.g. `"8-12"`); the helper only derives the bounds for `rep_range_min/max` |

### Persistence branch — `buildWorkoutExerciseInsertRow` non-bodyweight explicit-ranges (Edge + web)

Extend `GeneratedExerciseForProgram` type with optional fields:

```ts
type GeneratedExerciseForProgram = {
  // existing required fields
  exerciseId: string
  sets: number
  reps: string
  weightKg: number
  restSeconds: number
  // new optional fields
  repRangeMin?: number
  repRangeMax?: number
  setRangeMin?: number
  setRangeMax?: number
  targetDurationSeconds?: number  // T75 will use this
}
```

When the input includes explicit ranges (T74 path: object form for non-bodyweight, non-duration), set:
- `rep_range_min` = `repRangeMin` (= `parseRepsBounds(reps).min`)
- `rep_range_max` = `repRangeMax` (= `parseRepsBounds(reps).max`)
- `set_range_min` = `setRangeMin` (= `sets`)
- `set_range_max` = `setRangeMax` (= `sets`)
- `max_weight_reached` = `false` (existing default)

Otherwise (bare-string form, no explicit ranges), keep current auto-derive behavior unchanged.

| Item | Detail |
|---|---|
| Branch condition | `if (repRangeMin !== undefined && !isBodyweight)` |
| Type extension parity | The optional fields exist in BOTH Edge and web type definitions, even though web doesn't yet pass them (web AI flow stays bare-string only in T74) |
| Web AI flow non-regression | `AIProgramPreviewStep.tsx` does not pass the new optional fields; the bare-string branch is preserved and produces identical rows to today |

### Shared fixtures — `programPersistence_fixtures.json` (NEW file)

Single JSON file consumed by both Vitest and Deno test:

| Item | Detail |
|---|---|
| Location | `supabase/functions/mcp/lib/programPersistence_fixtures.json` |
| Loaded by | Vitest via `import fixtures from "../../../supabase/functions/mcp/lib/programPersistence_fixtures.json"`, Deno via `import fixtures from "./programPersistence_fixtures.json" with { type: "json" }` |
| Schema | Array of `{ name: string, input: GeneratedExerciseForProgram, expectedRow: WorkoutExerciseInsertRow }` |

Initial cases (≥9 cases total in T74):

1. Legacy bare-string barbell exercise (defaults: 3 sets, 10 reps, 0 kg, 90s rest) → auto-derived ranges
2. Legacy bare-string dumbbell exercise → same defaults
3. Legacy bare-string bodyweight exercise → defaults + `max_weight_reached: true` (current behavior preserved)
4. Existing edge case: `defaultReps = 0` for `chest_press_machine` (pre-Epic-B regression fix preserved)
5. Existing edge case: `defaultRestSeconds = 60` for `tricep_pushdown` (preserved)
6. Existing edge case: `setOrder` increments correctly (preserved)
7. **NEW**: Linear progression — `bench_press` 4×8 @ 80kg, 120s → `rep_range: 8/8, set_range: 4/4`
8. **NEW**: Double progression — `bench_press` 4×8-12 @ 80kg, 120s → `rep_range: 8/12, set_range: 4/4`
9. **NEW**: Mixed day — bare-string `pushup` + object-form `bench 4×8 @ 80kg` in same exercises array → row 1 has defaults+auto-derive, row 2 has explicit+frozen

### Test file refactor — both `programPersistence.test.ts` (Vitest) and `programPersistence_test.ts` (Deno)

| Item | Detail |
|---|---|
| Refactor pattern | Each test iterates `fixtures.forEach(({ name, input, expectedRow }) => { it(name, () => expect(buildWorkoutExerciseInsertRow(input)).toEqual(expectedRow)) })` |
| Existing assertions | Migrated 1-for-1 into fixture entries (cases 1-6 above); existing test files become a fixture-driven loop + any narrative tests that don't fit the data-driven shape |
| Parity invariant | If a fixture is added/changed, both Vitest and Deno suites pick it up automatically — no manual sync required |

### Format helper — `formatPrescriptionLine` in `lib/format.ts`

Add the second helper to the file created in T73:

```ts
formatPrescriptionLine(input: {
  exerciseName: string
  sets: number
  reps: string
  weightKg: number
  restSeconds: number
  weightConvention: WeightConvention
  targetDurationSeconds?: number  // T75 will use this branch
}): string
```

Output formats (T74 covers reps mode only; T75 adds duration mode):

- Reps mode, weighted: `"Bench Press — 4 × 8 × 80 kg total — 120s rest"`
- Reps mode, weighted dumbbell: `"DB Curl — 4 × 8-12 × 15 kg per hand — 90s rest"`
- Reps mode, bodyweight: `"Pushup — 4 × 12 (bodyweight) — 90s rest"` (kg suffix omitted)

| Item | Detail |
|---|---|
| Position | After `formatWeightConvention` in the same file |
| Suffix logic for kg unit | Skip kg suffix if `weightConvention === "bodyweight"` |
| Consumer | `createProgram.ts` dry_run echo path |
| Tests | Both Vitest and Deno test files extended with cases for each format above (3+ cases) |

### Dry_run echo — `createProgram.ts` preview output

When `dry_run: true`, the response body includes a per-day breakdown:

```ts
{
  preview: {
    days: [
      {
        name: string
        rendered: string[]  // one line per exercise via formatPrescriptionLine
      }
    ]
  }
}
```

| Item | Detail |
|---|---|
| Source of `weightConvention` per line | Equipment from the catalog Map → `formatWeightConvention(equipment)` |
| Side effect | None — dry_run does not insert anything in DB |
| Existing behavior preserved | The existing dry_run JSON shape is extended (additive `rendered` array per day), not replaced |

### Tool description rewrite — `createProgram.ts` `inputSchema.description`

Complete rewrite (~60-80 lines max). Sections:
1. One-line summary of what the tool does
2. The two input forms with one example each (bare string, full object)
3. Bounds table (sets, reps regex, weight, rest, target_duration)
4. Pointer to `get_exercise_details` for `weight_convention` guidance
5. Migration note (1 line: "Breaking change in v0.3.0: `exercise_ids` removed")

If the description grows past ~80 lines, defer the verbose examples to SKILL.md "Common write patterns" and link to it from the tool description.

### Skill doc update — `skills/gymlogic-mcp/SKILL.md`

Create new section **"Common write patterns"** with TWO worked examples (T75 will append two more):

| Pattern | Example call |
|---|---|
| **Linear progression** (fixed sets/reps, weight increases) | `create_program` with `bench_press` 4×8 @ 80kg, RDL 3×5 @ 100kg |
| **Double progression** (reps grow within range, then weight bumps) | `create_program` with `bench_press` 4×8-12 @ 80kg |

Each example shows:
- The agent prompt that resolves to the call
- The JSON sent to `create_program`
- The expected `rendered` echo
- A 1-line note on what `rep_range_min/max` and `set_range_min/max` will be (frozen for these cases)

### Manual E2E deliverables (PR description, not code)

Per Q5 user instruction, manual E2E is verified by the user via Claude Desktop and the agent (this assistant) via SSH probes against Iris. T74 must produce in the PR description:

| Deliverable | Detail |
|---|---|
| Claude Desktop test prompts | 5 prompts covering: bare-string fallback, linear barbell, double-progression dumbbell, mixed bare+object day, legacy-input migration error |
| Iris skill update snippet | A copy-paste block formatted for the Iris `SKILL.md` (different format from `gymlogic-mcp/SKILL.md`) covering the new write contract |
| SSH probe checklist (executed by agent) | (a) `tools/list` returns version `0.3.0`; (b) bare-string call works; (c) linear call inserts row with frozen ranges; (d) legacy-input call returns migration error |

## Out of Scope

- Bodyweight exercise handling (auto-derive ranges + reject `weight_kg > 0`) — owned by **T75**
- Duration exercise handling (`target_duration_seconds` semantics + cross-field rules with reps/weight) — owned by **T75**
- Bodyweight pattern and mixed reps/duration day examples in SKILL.md "Common write patterns" — owned by **T75**
- Weighted bodyweight support (e.g. weighted dips, weighted pull-ups) — tracked in **#281**, deferred to a future epic
- `update_program` tool — Epic C (issue #280)
- Set-level overrides (drop sets, AMRAP) — Epic Brief out of scope
- Agent passing `rep_range_min/max` / `set_range_min/max` directly — derived only, not accepted as input
- Weight unit conversion (lbs ↔ kg) — Epic Brief out of scope, kg only
- Migration / backfill of programs created on `0.2.x` — Epic Brief out of scope, no DB migration
- Deprecation period for `exercise_ids` — Q12 lock, hard breaking with structured error message
- Atomicity redesign of the multi-step program creation — Epic Brief out of scope, compensating rollback retained
- Modification of `set_logs` schema or behavior — Epic Brief out of scope
- Web UI changes to `AIProgramPreviewStep.tsx` to consume the new fields — Epic Brief out of scope, web AI flow stays bare-string only

## Acceptance Criteria

- [ ] `tools/list` response shows `serverInfo.version === "0.3.0"`
- [ ] Calling `create_program` with `exercise_ids: [...]` at the day level returns the migration error containing the string `"v0.3.0"` and the example of the new shape
- [ ] Calling `create_program` with `exercises: ["<uuid>"]` (bare-string fallback) inserts a row with the existing legacy defaults (`sets=3, reps="10", weight="0", rest=90`) and auto-derived ranges (`rep_range: 8/12, set_range: 2/5`) — identical to pre-Epic-B behavior
- [ ] Calling `create_program` with `exercises: [{ exercise_id, sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120 }]` on a barbell exercise inserts a row with `sets=4, reps="8", weight="80", rest=120, rep_range_min=8, rep_range_max=8, set_range_min=4, set_range_max=4`
- [ ] Same call with `reps: "8-12"` inserts a row with `rep_range_min=8, rep_range_max=12, set_range_min=4, set_range_max=4`
- [ ] Calling `create_program` with `dry_run: true` returns a `preview.days[].rendered` array containing lines like `"Bench Press — 4 × 8 × 80 kg total — 120s rest"` for each prescribed exercise
- [ ] Out-of-bounds inputs (`sets: 11`, `reps: "51"`, `weight_kg: 501`, `rest_seconds: 601`) each return a field-named bounds error citing the exercise position in the day
- [ ] Invalid `reps` strings (`"abc"`, `"8-"`, `"-8"`, `"8-5"` (max < min)) each return a regex/range error citing the exercise position
- [ ] `programPersistence_fixtures.json` exists with ≥9 cases (6 legacy migrated + 3 new); all cases pass identically in Vitest (`npm test`) and Deno (`deno test supabase/functions/mcp/lib/programPersistence_test.ts --allow-env`)
- [ ] Existing `src/lib/programPersistence.test.ts` Vitest assertions for the web AI flow path produce identical expected rows after refactor (no behavior regression, the file is now fixture-driven but the legacy expected rows match byte-for-byte)
- [ ] `formatPrescriptionLine` exists in `lib/format.ts` and produces the 3 documented formats (weighted total, weighted per_hand, bodyweight); covered by Vitest and Deno tests
- [ ] `skills/gymlogic-mcp/SKILL.md` has the new "Common write patterns" section with linear progression + double progression examples (2 examples; T75 adds 2 more)
- [ ] Tool description in `createProgram.ts` `inputSchema.description` is rewritten and stays under ~80 lines (or links to SKILL.md if it would exceed)
- [ ] PR description contains the 5 Claude Desktop test prompts, the Iris skill update snippet, and a checkbox list of completed SSH probes against Iris
- [ ] No existing test in the repo regresses (`npm test` green; existing `deno test` suites green)

## References

- Epic Brief: [`docs/Epic_Brief_—_MCP_—_create_program_Prescription_#276.md`](./Epic_Brief_—_MCP_—_create_program_Prescription_#276.md) — see user stories 1, 2, 3, 4, 5, 7, 12, 13 + linear/double rows of story 14
- Tech Plan: [`docs/Tech_Plan_—_MCP_—_create_program_Prescription_#276.md`](./Tech_Plan_—_MCP_—_create_program_Prescription_#276.md) — see "Architectural Approach" Key Decisions on union schema, all-or-nothing object form, freeze semantics, regex, version bump; "Critical Constraints" on `programPersistence.ts` parity, `min === max` progression engine handling, web canary; "Component Responsibilities" on `createProgram.ts` validation order
- GitHub issue: [#276 — MCP: Read all programs without cycle + Edit existing programs](https://github.com/PierreTsia/workout-app/issues/276)
- Predecessor ticket: [`docs/T73_—_weight_convention_Enrichment_+_format_Helpers.md`](./T73_—_weight_convention_Enrichment_+_format_Helpers.md)
- Successor ticket: [`docs/T75_—_Special-Case_Handling_Bodyweight_+_Duration.md`](./T75_—_Special-Case_Handling_Bodyweight_+_Duration.md)
- Existing handler to extend: `file:supabase/functions/mcp/tools/createProgram.ts`
- Existing persistence module (Edge): `file:supabase/functions/mcp/lib/programPersistence.ts`
- Existing persistence module (web mirror): `file:src/lib/programPersistence.ts`
- Existing test suites: `file:supabase/functions/mcp/lib/programPersistence_test.ts`, `file:src/lib/programPersistence.test.ts`
- Web AI flow consumer (non-regression target): `file:src/components/create-program/AIProgramPreviewStep.tsx`
- Server info location: `file:supabase/functions/mcp/index.ts`
- Skill doc to update: `file:skills/gymlogic-mcp/SKILL.md`
