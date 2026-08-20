# T206 — Personal history / PB on the shelf detail

## Goal

The seed detail shows the athlete’s catalog-keyed AMRAP runs (PB / deltas / `noPrYet`) without mounting `BlockHistorySheet`. Stories 6–7, 11.

## Mode

**AFK** — hook and row chrome already exist. Extract, don’t reinvent scores.

## Slice

Export `AmrapRunRow` → `useBenchmarkCompletionHistory(true, seed.id)` on `CircuitCatalogSeedPage` → empty / offline / error / list → vitest

## Dependencies

T205.

## Scope

### Extract

- Move `AmrapRunRow` (and its delta chip if coupled) from `file:src/components/history/BlockHistorySheet.tsx` to e.g. `file:src/components/history/AmrapRunRow.tsx` so the sheet and the shelf share one row.
- Sheet keeps using it. No visual redesign.

### Detail page

- After story + Rx: history section
- `useBenchmarkCompletionHistory(true, seed.id)` — `open` is always true on this page
- `!isOnline` → `history:circuit.offline` (use `useOnlineStatus`)
- Loading / error+retry copy from `history:circuit.*`
- Empty → `history:circuit.noPrYet` (not `noCompletedRuns` — this is catalog identity)
- Else `<ul>` of `AmrapRunRow`
- Do **not** render `BlockHistorySheet`
- Do **not** join achievements

### Tests

- Mock history hook or supabase: empty → `noPrYet`; one+ views → scores render; instantiate still absent
- Sheet tests still green after the extract

## Out of Scope

- Tours completion-time trend (seeds are AMRAP)
- Grant-on-TIME / #482
- Add-to-day CTA
- Finish-screen badges

## Acceptance Criteria

- [ ] First visit (no runs) shows `noPrYet`, story still visible
- [ ] Finished Cindy runs show the same score/PB language as the history sheet (shared `AmrapRunRow`)
- [ ] Offline shows the circuit offline string, not a fake PB
- [ ] `BlockHistorySheet` is not in the detail tree
- [ ] `rg BlockHistorySheet src/pages/library` is empty
- [ ] Vitest stripped-env green; existing `BlockHistorySheet.test.tsx` green

## References

- Epic Brief stories 6–7, 11
- `file:src/hooks/useBenchmarkCompletionHistory.ts`
- `file:src/components/history/BlockHistorySheet.tsx` (catalog branch)
