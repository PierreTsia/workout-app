# T191 — Schema + seed + instantiate + MCP write

## Goal

Cindy exists as a **Benchmark Circuit** (`slug: cindy`, Rx JSONB, canonical FR/EN copy). MCP `create_program` / `create_workout_day` / `update_program` instantiate by `benchmark_slug` / id (catalog Rx wins) or **coerce** from label/alias (`Cindy`, `Holland`). Generic Circuits stay jetable (`benchmark_circuit_id IS NULL`). Writes ADR `0015`. Stories 1, 2, 5, 6, 7, 8, 18, 19, 20, 23, 24.

## Mode

**AFK** — copy, coerce, and schema are locked in the Epic Brief / Tech Plan. HITL device pass → **T198**.

## Slice

`migration + RLS + seed` → Edge/PWA `resolveBenchmark` + `instantiateBenchmark` → `parseCircuitInput` + three write tools → Deno/vitest + ADR 0015

## Dependencies

None. Unblocks T192–T197.

## Scope

### Schema — `supabase/migrations/YYYYMMDD_benchmark_circuits.sql`

- Table `benchmark_circuits` as Tech Plan (slug, `owner_id`, `forked_from`, aliases, tagline/story FR+EN, `reference` jsonb, `rx` jsonb, CHECK slug XOR owner, unique partial index on slug).
- RLS: SELECT `owner_id IS NULL OR owner_id = auth.uid()` ; INSERT/UPDATE/DELETE `owner_id = auth.uid()` only (forks). Seeds: no user write.
- `exercise_blocks.benchmark_circuit_id` nullable FK `ON DELETE SET NULL`.
- Seed Cindy: `owner_id NULL`, `slug = cindy`, `aliases = '{holland,tom holland}'`, copy from Epic Brief **Cindy seed copy**, `rx.mode = amrap`, `cap_seconds = 1200`, amounts 5/10/15, `exercise_id` from `exercises.name` `Tractions` / `Pompes` / `Squat au poids du corps`. Missing exercise → migration fails.

### Types

- `file:src/types/database.ts` : `BenchmarkCircuit`, `ExerciseBlock.benchmark_circuit_id`, no `block_runs` column yet (**T193**).

### Instantiate / resolve

- `file:src/lib/resolveBenchmark.ts` + `file:supabase/functions/mcp/lib/resolveBenchmark.ts` (twins): by id, slug, or alias (case-insensitive, trim).
- `file:src/lib/instantiateBenchmark.ts` + Edge twin: copy `rx` → `exercise_blocks` + `block_exercises` (AMRAP rest/transition 0, label `Cindy`), stamp FK. Fail clearly if any `exercise_id` missing — no half-Cindy.

### MCP parse — `file:supabase/functions/mcp/lib/createProgramValidation.ts` + `circuitItemSchema.ts`

- Parse `benchmark_slug` / `benchmark_id` (unknown keys must **not** drop them).
- Present + unknown → **error**, no insert.
- Present + known → **replace** exercises/mode/cap with catalog Rx.
- Absent + `label` matches seed slug/alias → **coerce** (same as present). Accepted false positive: a jetable literally named Cindy.
- Else jetable, `benchmark_circuit_id` null.
- Lockstep `createProgram` / `createWorkoutDay` / `updateProgram`. Echo `benchmark_slug` on details/dry_run when linked (`daySequenceRead`).

### ADR

- `docs/adr/0015-benchmark-circuit-catalog-identity.md` from grilling + Tech Plan (entity, snapshot copy, contract = identity, GO snapshot *column specified, write in T193*, JSONB, coerce, no backfill).

## Out of Scope

- `block_runs.benchmark_circuit_id` → **T193**.
- QW generate / `toMcpCircuit` → **T192**.
- History sheet / MCP history grouping → **T194** / **T195**.
- Circuit Fork → **T196**.
- Skill prose → **T197**.
- Backfill of existing labeled Cindys. Do Cindy. Shelf. Picker. Zeus.

## Acceptance Criteria

- [ ] Seed row `slug=cindy` with canonical tagline/story/reference ; 0 empty/lorem story fields.
- [ ] `create_workout_day` `{ type: "circuit", benchmark_slug: "cindy" }` persists FK = seed, Rx bytes = seed JSONB (5/10/15, AMRAP 20 min), not caller exercises.
- [ ] `benchmark_slug: "not-a-wod"` → error, no insert.
- [ ] `{ type: "circuit", label: "Holland" }` (no slug) → coerce to cindy, same FK/Rx.
- [ ] Generic AMRAP without seed name → `benchmark_circuit_id IS NULL`.
- [ ] `rg` in `src/` has no Cindy Rx constant used to persist a block.
- [ ] RLS: authenticated user can SELECT the seed ; cannot UPDATE it ; can INSERT a row with `owner_id = auth.uid()`.
- [ ] ADR 0015 exists. Deno + vitest cover resolve / instantiate / parse coerce / reject.

## References

- Epic Brief `file:docs/Epic_Brief_—_Circuit_Catalog_Cindy_identity_#398.md` (stories 1–2, 5–8, 18–20, 23–24 ; Cindy seed copy)
- Tech Plan `file:docs/Tech_Plan_—_Circuit_Catalog_Cindy_identity_#398.md` (Data Model, instantiate, MCP parse)
