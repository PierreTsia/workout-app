# ADR 0015 — Benchmark Circuit catalog identity

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decided in:** grill-with-docs + Tech Plan for [#398](https://github.com/PierreTsia/workout-app/issues/398)

## Context

Named WODs (Cindy, later Zeus) were being minted as jetable **Exercise Blocks** every time MCP or Quick Workout heard "Cindy". Two Tuesdays were two `block_id`s; the personal PR could not accumulate under Cindy. Hardcoding 5-10-15 in the client would make the name a nickname, not a contract.

An **Exercise Block** is day-scoped (`workout_day_id` + `sort_order`). Promoting one to a catalog row would couple identity to a day slot. **Circuit Completion Time** (ADR 0008) and **Block Runs** (ADR 0014) stay the execution model; they are not the catalog.

## Decision

We will:

1. Add `benchmark_circuits` as its own entity: immutable `slug` on GymLogic seeds (`owner_id` NULL), `slug` NULL on user **Circuit Forks**, localized tagline/story, editorial `reference` jsonb, Rx **JSONB** (`mode`, `cap_seconds`, `[{ exercise_id, amount, weight }]`). CHECK: slug XOR owner. Unique partial index on slug.
2. Instantiate by **snapshot copy** onto `exercise_blocks` + `block_exercises`, stamping nullable `exercise_blocks.benchmark_circuit_id` (`ON DELETE SET NULL`). Jetable Circuits stay `NULL`. Catalog Rx wins over caller/LLM exercises.
3. Treat the catalog id as identity. Comparability still uses `templateFingerprint` (mode + cap + amounts). A later **Circuit Fork** retargets the day slot; Monday's run must keep Cindy — that GO snapshot column is specified here (`block_runs.benchmark_circuit_id`) and **written in T193**, not this ticket.
4. Resolve MCP / QW intent by `benchmark_slug` / `benchmark_id` / label alias (`cindy`, `holland`, `tom holland`). Present + unknown → error, no insert. Absent + label match → **coerce** (accepted false positive: a jetable literally named Cindy). No backfill of existing labeled Cindys.
5. Keep seed writes in the migration (same as `exercises`). Authenticated users can SELECT seeds; they cannot UPDATE/DELETE them; they can INSERT a fork with `owner_id = auth.uid()`.

## Consequences

- **Positive:** Two Cindys compare. Agents cannot mint a snowflake 6-11-16 labeled Cindy. Generic AMRAP stays jetable. Story/Holland copy ships with the seed, not as a follow-up.
- **Negative:** Dual `instantiateBenchmark` / `resolveBenchmark` twins (PWA + Edge). Coerce false-positive on a user-named "Cindy". Seed `exercise_id`s bind to FR `exercises.name` — a rename breaks the JSONB (same risk as program templates); instantiate fails clearly rather than writing a half-Cindy.
- **Follow-ups:** T192 QW `toMcpCircuit`; T193 GO snapshot on `block_runs`; T194–T195 history grouping; T196 Circuit Fork; T197 skill prose.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Promote `exercise_blocks` to catalog | Day instance needs `workout_day_id` + `sort_order`; catalog is identity + source Rx |
| Child table for catalog exercises | JSONB matches `templateFingerprint`; fork = copy row; additive later |
| Live-bind the day block to catalog Rx | Would rewrite history when the seed is patched; Round Screen stays on a day block |
| Backfill existing labeled Cindys | False positives; tracer starts at ship |
| Client-hardcoded 5-10-15 | Name would not be the contract; catalog id is the persist path |
