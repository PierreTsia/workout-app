# ADR 0017 — Pantheon seeds stay AMRAP and carry a display label

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decided in:** Epic Brief and Tech Plan for [#480](https://github.com/PierreTsia/workout-app/issues/480)

## Context

The first **Benchmark Circuit** seed, Cindy, proved catalog identity and AMRAP history. The Pantheon expands that catalog with eight named WODs, but earlier product language described Zeus as Cindy's **Tours** twin. A Tours benchmark would need catalog support for fixed rounds, pyramidal `per_round` prescriptions, and a history stamp equivalent to **Block Run** before its scores could be compared safely.

The current catalog path is deliberately Cindy-shaped: a flat three-station Rx, `mode: "amrap"`, and history keyed by `block_runs.benchmark_circuit_id`. The immutable ASCII slug is suitable for resolution but not for display names such as `Zeus ⚡`. Quick Workout's closed-intent coerce also recognizes Cindy-specific keys only.

## Decision

We will:

1. Ship this Pantheon wave as eight flat, bodyweight, three-station **AMRAP** seeds. Olympiens use a 20-minute cap; Héros use a 10-minute cap.
2. Add a required `label` to `benchmark_circuits` and use it as the display name. The immutable slug remains the public machine identity.
3. Treat **Olympien**, **Héros**, and **Specialty** as editorial catalog metadata expressed through the roster and taglines, not new database columns.
4. Defer Tours benchmarks, pyramidal catalog Rx, and their history contract to a separate decision.
5. Keep Quick Workout closed-intent coercion Cindy-only. MCP and other explicit write paths resolve Pantheon WODs by `benchmark_slug`; [#480](https://github.com/PierreTsia/workout-app/issues/480) does not generalize `CINDY_SEED_KEYS`.

## Consequences

- **Positive:** All nine GymLogic seeds use the existing instantiate, GO snapshot, history, and PR path. Agents resolve Zeus by catalog identity instead of minting a remembered recipe. Labels can carry editorial display names and emoji without weakening stable slugs.
- **Negative:** Personal Tours or pyramid Circuits named Zeus are not the catalog Zeus. Quick Workout text such as “une zeus” can still produce a jetable Circuit instead of coercing to the seed.
- **Follow-ups:** Define a Tours-benchmark execution and history contract before adding fixed-round or pyramidal seeds. Generalize Quick Workout named-WOD coercion only in a separately scoped change.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Seed Zeus as a Tours pyramid now | `block_runs` and the catalog Rx shape do not provide a comparable Tours benchmark contract |
| Infer display names from slugs | ASCII Title Case cannot express canonical names such as `Zeus ⚡` |
| Add cast and specialty columns | Olympien / Héros and Specialty are editorial structure, not behavior queried independently of the localized tagline |
| Generalize Quick Workout coerce in this wave | It couples a prompt heuristic to catalog expansion and violates #480's explicit Cindy-only boundary |
