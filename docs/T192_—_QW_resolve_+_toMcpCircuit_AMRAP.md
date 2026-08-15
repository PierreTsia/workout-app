# T192 — QW resolve + toMcpCircuit AMRAP

## Goal

Quick Workout closed-intent Cindy/Holland no longer mints a snowflake: after generate, drop LLM exercises and pass `benchmark_slug`. Fix `toMcpCircuit` so AMRAP `mode` / `cap_minutes` (and slug) survive commit — today preview is AMRAP and commit is 1-round Tours. Stories 20, 22.

## Mode

**AFK** — post-LLM replace is locked. HITL « AI generate Cindy » → **T198**.

## Slice

`handleGenerateQuickWorkout` post-validate → `toMcpCircuit` mapper → `commit-quick-workout` → MCP instantiate (T191) → vitest fixtures

## Dependencies

T191 (seed + MCP instantiate by slug).

## Scope

### Generate — `file:supabase/functions/generate-quick-workout/handler.ts` (+ validate/prompt tests)

- After `validateAndRepair`: if closed-intent (`file:supabase/functions/_shared/amrapIntentPrompt.ts`) **or** an item label matches a seed slug/alias → replace that circuit item with `{ type: "circuit", benchmark_slug: "cindy" }` (no LLM exercises). Catalog wins, including « 4 rounds Cindy » → official AMRAP 20.
- Generic « HIIT 20 min » / no seed name : unchanged jetable path.

### Commit mapper — `file:src/lib/quickWorkout.ts`

- `toMcpCircuit` must pass `mode`, `cap_minutes`, `benchmark_slug` (today it emits Tours-only fields and drops AMRAP).
- Slug-only items from generate must round-trip to MCP without requiring nested exercises on the client.

## Out of Scope

- Home **Do Cindy** (#393).
- Changing the closed-intent *prompt* list (still Cindy/Holland/AMRAP) beyond consuming it for replace.
- Fork, history, GO stamp.

## Acceptance Criteria

- [ ] Fixture « Cindy » / « Holland » → commit persists `benchmark_circuit_id` = seed, Rx = seed JSONB, not the model’s numbers.
- [ ] Fixture « HIIT 20 min » → jetable, `benchmark_circuit_id IS NULL`.
- [ ] Generic AMRAP (no seed name) commit keeps `mode: "amrap"` + cap (not 1-round Tours).
- [ ] Vitest/Deno: `toMcpCircuit` snapshot includes `mode` / `cap_minutes` / `benchmark_slug`.

## References

- Epic Brief stories 20, 22
- Tech Plan QW post-LLM + **Critical Constraint** `toMcpCircuit`
- `file:src/lib/quickWorkout.ts`, `file:supabase/functions/generate-quick-workout/handler.ts`
