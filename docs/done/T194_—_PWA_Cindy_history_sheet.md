# T194 — PWA Cindy history sheet

## Goal

The **Block history sheet** for a catalog-linked Circuit lists all of *that* **Benchmark Circuit**’s runs (catalog id + `templateFingerprint`), not one `block_id`. Header shows canonical tagline / story / Holland `reference` as **copy**, never a sparkline row. Jetable Circuits keep today’s `block_id` sheet. Stories 3, 4, 9, 10, 12.

## Mode

**AFK** — copy strings are in the seed (T191); layout reuses `BlockHistorySheet`. Visual HITL → **T198**.

## Slice

`useBenchmarkCompletionHistory` (query `block_runs.benchmark_circuit_id`) → `BenchmarkStoryHeader` → `BlockHistorySheet` / `SessionRow` branch → vitest + component tests

## Dependencies

T193 (GO snapshot). MCP history → **T195**.

## Scope

### Data

- `file:src/hooks/useBenchmarkCompletionHistory.ts` : fetch runs where `block_runs.benchmark_circuit_id = $id`, join logs, reuse `annotateAmrapRuns` (PB/delta by fingerprint inside that id). Load seed story/reference for the header.
- Jetable path: existing `file:src/hooks/useBlockCompletionHistory.ts` **unchanged**.

### UI

- `file:src/components/history/BenchmarkStoryHeader.tsx` : tagline + story by **Display Locale** ; Holland beat as editorial line. **0** fake run rows.
- `file:src/components/history/BlockHistorySheet.tsx` + `file:src/components/history/SessionRow.tsx` : if group has catalog id → catalog hook + header ; else blockId sheet.
- Empty/first run: story + no delta (not Holland as a competitor).
- shadcn primitives only ; no new screen ; no Stitch.

## Out of Scope

- MCP `get_workout_history` grouping → **T195**.
- Do Cindy, catalog tab, `/library`.
- Achievement RPC.

## Acceptance Criteria

- [ ] Two ad-hoc days instantiated from `cindy`, both completed → one sheet, second run updates the **same** PB.
- [ ] Cap 10 (different fingerprint) does not steal the 20 min PB.
- [ ] Holland reference rendered as copy ; **0** fake run rows in list/sparkline.
- [ ] First Cindy run: story visible, no fake delta.
- [ ] Jetable Circuit sheet still keyed by `block_id` (non-regression).
- [ ] Component tests for header + grouping ; `isRunComplete` / `runFingerprint` untouched.

## References

- Epic Brief stories 3, 4, 9, 10, 12 ; Cindy seed copy
- Tech Plan `BlockHistorySheet` / `BenchmarkStoryHeader`
- `file:src/lib/amrapScore.ts` `annotateAmrapRuns`
