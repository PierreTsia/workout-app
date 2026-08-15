# ADR 0014 — AMRAP mode and persisted Block Runs

- **Status:** Accepted
- **Date:** 2026-08-15
- **Decided in:** grill-with-docs + Tech Plan for [#474](https://github.com/PierreTsia/workout-app/issues/474)

## Context

**Exercise Blocks** (#351) terminate on a fixed `rounds` count. **Circuit Completion Time** (ADR 0008) is *derived* from `set_logs` with **no persisted clock**, and is a stat rather than a score. That model fits **Tours** (N rounds, time is the result). It cannot express **AMRAP**: the cap *is* the constraint, rounds are the score (`27+3`), GO happens *before* the first log, and a honest leftover run is a ragged last round — which `isRunComplete` (ADR 0008 rectangle) would exclude from the PB.

`set_logs` for blocks carry **no** `prescribed_*` snapshot (ADR 0007) and no cap. A fingerprint rebuilt from logs cannot know that two Cindys differed by 20 min vs 10 min. Kill-app at T+12:00 cannot restore remaining time from logs that do not exist yet.

## Decision

We will:

1. Add `exercise_blocks.mode` (`'rounds' | 'amrap'`, default `'rounds'`) and `cap_seconds` (nullable; required iff AMRAP, 60–3600). Existing rows stay **Tours** with zero semantic backfill. AMRAP keeps `rounds = 1` (template length); `per_round.length === 1`; rest/transition forced to 0.
2. Persist an AMRAP execution as a **Block Run** (`block_runs`): `(session_id, block_id)` unique, `started_at` at GO, `finished_at` at TIME/Terminer, `template_fingerprint` + `cap_seconds` **snapshotted at GO**. Offline-first via a new sync-queue type `block_run`, minted with `resolveSessionMeta` like `set_log` (GO may be the first enqueue, before any Valider).
3. **Not** persist a clock for **Tours**. Elapsed chrome is display-only; history stays ADR 0008 `MAX−MIN`. ADR 0008 is amended only for AMRAP: the cap is a real wall-clock from `started_at`; pause does not freeze it.
4. Derive leftover from `set_logs` (ragged last round's actual + exercise name). No leftover columns on `block_runs`. Completeness = `finished_at IS NOT NULL`. Annuler deletes the row and wipes logs.
5. Leave `isRunComplete` / `runFingerprint` **untouched**. AMRAP scoring is a parallel lib (`amrapScore`) keyed by `template_fingerprint`, PB = max (full rounds, leftover).

## Consequences

- **Positive:** Kill-app restores remaining cap. Cap edits don't rewrite past PBs. Tours Zeus behavior is byte-identical. MCP can add `mode` / `cap_minutes` without a new tool.
- **Negative:** New table + queue type; session may be minted at GO rather than first set_log. Rollback is lossy (AMRAP rows with `rounds=1` would look like 1-round Tours).
- **Follow-ups:** Epic Brief / Tech Plan `file:docs/Epic_Brief_—_Circuit_AMRAP_#474.md`, `file:docs/Tech_Plan_—_Circuit_AMRAP_#474.md`. **Benchmark Circuit** (#398) still separate.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| localStorage-only GO stamp | Survives kill-app on one device; no fingerprint snapshot; no MCP history `27+3` |
| jsonb on `sessions` | No such column; GO is per-block not per-session; mixed-day squat then Cindy |
| Piggyback first `set_log` as start | GO is *before* the first Valider; empty-work kill-app would reset 20:00 |
| Nullable `rounds` when AMRAP | Honest, but every client `.rounds` and the CHECK change; `= 1` is the template length |
| Soften `isRunComplete` for ragged rounds | Would mark incomplete **Tours** as complete / poison Zeus PBs |
| Snapshot leftover columns on `block_runs` | Second source of truth next to `set_logs` actuals |
| Fork `amrapRunner` | Two Round Screens to keep in sync (GO, chrome, leftover) |
