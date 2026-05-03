# T73 — `weight_convention` Enrichment + format Helpers

## Goal

Ship the read-side enrichment of `get_exercise_details` so an agent can query an exercise and learn how its weight should be expressed (`per_hand` for dumbbells/kettlebells, `total` for barbells/machines, `bodyweight` for unloaded calisthenics). Also create the `formatWeightConvention` helper in `lib/format.ts` that T74 will consume to produce the dry_run echo. Delivers user story **6** of the Epic Brief.

After this ticket, an agent running *"hey Iris, donne-moi les détails de l'exercice X avant que je l'ajoute à un programme"* sees an explicit weight convention line that disambiguates dumbbell vs barbell weight semantics — preventing the doubled-load bug where the agent passes `40 kg` for dumbbell rows expecting "total" but the user intended "per hand".

## Mode

**AFK** — every decision is locked in the Tech Plan (fallback `"total"` + `console.warn`, equipment-derived not column-derived, no migration).

## Slice (layers traversed)

Pure helper (`formatWeightConvention` in `lib/format.ts`) → handler one-line addition (`getExerciseDetails.ts`) → Vitest + Deno test on the helper → SKILL.md "Weight conventions per equipment" section update.

## Dependencies

None. T73 has no upstream blockers and is the foundation for T74's dry_run echo.

## Scope

### Helper — `formatWeightConvention` in `supabase/functions/mcp/lib/format.ts`

Pure function. Signature:

```ts
type WeightConvention = "per_hand" | "total" | "bodyweight"

formatWeightConvention(equipment: string): WeightConvention
```

Mapping table (locked by Tech Plan):

| Equipment value | Convention | Rationale |
|---|---|---|
| `dumbbell` | `per_hand` | Two implements, "40 kg" means 40 per hand |
| `kettlebell` | `per_hand` | Same logic as dumbbell |
| `barbell` | `total` | Single bar, weight on it is the total load |
| `machine` | `total` | Stack value displayed = total load |
| `cable` | `total` | Same as machine |
| `bodyweight` | `bodyweight` | No external load |
| `band` | `total` | Resistance level applies as a single value |
| `other` | `total` | Catch-all for catalog edge cases |
| `<unknown>` | `total` (with `console.warn`) | Fallback, surface the gap server-side |

| Item | Detail |
|---|---|
| Export | Named export, no default |
| Side effect | `console.warn` only on unknown branch; the 8 known equipment values produce no warning |
| Type export | Also export `WeightConvention` union type for use in T74 |

### Handler — one-line addition in `supabase/functions/mcp/tools/getExerciseDetails.ts`

After the existing `equipment` line in the markdown output, insert:

```
**Weight convention:** {convention} ({human-readable hint})
```

Where `human-readable hint` is:
- `per_hand` → `"each hand"`
- `total` → `"total load on the implement"`
- `bodyweight` → `"no external load"`

| Item | Detail |
|---|---|
| Position | Immediately after the `equipment` line, before any other field |
| Import | `import { formatWeightConvention } from "../lib/format.ts"` |
| Behavior on missing equipment | If `exercise.equipment` is `null` or `undefined`, default the input to `"other"` before passing to the helper (do not `console.warn` — that's the helper's responsibility for genuinely unknown values) |

### Vitest + Deno tests on the helper

Add a `describe("formatWeightConvention")` block to both test files (parity required):

| Test file | Path |
|---|---|
| Vitest | `supabase/functions/mcp/lib/format.test.ts` (existing — extend it) |
| Deno | `supabase/functions/mcp/lib/format_test.ts` (create if missing, mirror Vitest) |

Cases to cover:
- All 8 known equipment values return their expected convention (one assertion each)
- Unknown equipment (`"foo"`) returns `"total"` AND triggers `console.warn` (spy or capture mechanism)
- Empty string returns `"total"` AND warns
- Type assertion: return value is exactly `WeightConvention` union (no string widening)

### Skill doc update — `skills/gymlogic-mcp/SKILL.md`

Locate the existing "Weight conventions per equipment" section (read-side). Add a paragraph that explicitly says:

> `get_exercise_details` now exposes a `weight_convention` field directly in its markdown output. Future write tools (`create_program`, `update_program`) will use the same convention to interpret the `weight_kg` you send. When in doubt, call `get_exercise_details` first.

Do NOT yet rewrite the `create_program` documentation in this section — that is owned by T74. This ticket only updates the read-side doc.

## Out of Scope

- `formatPrescriptionLine` helper in `format.ts` — owned by T74 (it's used by the dry_run echo, which is a T74 deliverable).
- Any modification to `create_program`, `programPersistence.ts`, or its tests — owned by T74.
- Adding `weight_convention` as a stored column on the `exercises` table — explicitly rejected in the Tech Plan (derived field, not stored).
- Updating the `equipment` enum or catalog — out of scope for the entire epic.
- Updating `docs/mcp-connect/example-prompts.md` — owned by T74 (which has the prescription examples).

## Acceptance Criteria

- [ ] `formatWeightConvention` exists in `supabase/functions/mcp/lib/format.ts` with the exact signature documented above and is correctly typed (returns `WeightConvention` union, not `string`)
- [ ] Calling `get_exercise_details` for a `dumbbell` exercise (e.g. dumbbell curl) returns markdown containing the line `**Weight convention:** per_hand (each hand)`
- [ ] Calling `get_exercise_details` for a `barbell` exercise returns the line `**Weight convention:** total (total load on the implement)`
- [ ] Calling `get_exercise_details` for a `bodyweight` exercise returns the line `**Weight convention:** bodyweight (no external load)`
- [ ] Vitest test (`format.test.ts`) covers all 8 known equipment values + the unknown fallback with warn assertion, all green via `npm test`
- [ ] Deno test (`format_test.ts`) covers the same 8+1 cases with parity, green via `deno test supabase/functions/mcp/lib/format_test.ts --allow-env`
- [ ] An unknown equipment value (`"foo"`) calling `formatWeightConvention` produces a `console.warn` server-side AND returns `"total"`
- [ ] `skills/gymlogic-mcp/SKILL.md` "Weight conventions per equipment" section has the new paragraph mentioning `get_exercise_details` exposes `weight_convention`
- [ ] No existing test in the repo regresses (`npm test` green; existing `deno test` suites green)

## References

- Epic Brief: [`docs/Epic_Brief_—_MCP_—_create_program_Prescription_#276.md`](./Epic_Brief_—_MCP_—_create_program_Prescription_#276.md) — see user story 6
- Tech Plan: [`docs/Tech_Plan_—_MCP_—_create_program_Prescription_#276.md`](./Tech_Plan_—_MCP_—_create_program_Prescription_#276.md) — see "Key Decisions" rows on `weight_convention` derivation and fallback policy
- GitHub issue: [#276 — MCP: Read all programs without cycle + Edit existing programs](https://github.com/PierreTsia/workout-app/issues/276)
- Existing handler to mirror conventions: `file:supabase/functions/mcp/tools/getExerciseDetails.ts`
- Existing format helper file: `file:supabase/functions/mcp/lib/format.ts`
- Existing format test file: `file:supabase/functions/mcp/lib/format.test.ts`
