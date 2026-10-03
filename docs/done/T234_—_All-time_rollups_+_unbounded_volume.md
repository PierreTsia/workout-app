# T234 — All-time rollups + unbounded volume

## Goal

**Toujours** is a real window: year-grain Mix / pulse / Records / Tonnage from `get_profile_all_time_rollups`, Équilibre from `get_volume_by_muscle_group_all_time`, **no vs-préc. deltas**. Same VM types as bounded windows (`includeDeltas: false`). Addresses Epic story 4 (all-time half).

## Mode

AFK — dual compute path and “no lifetime `set_logs` dump” are locked.

## Slice

migrations (rollups + unbounded volume) → `useProfileSnapshot` all-time key → existing blocks with null deltas → vitest (shared Mix vectors TS vs SQL, no delta pills, History 365 clamp unchanged)

## Dependencies

T227, T228, T229, T230 (bounded blocks must already consume VMs with nullable deltas). T233 optional for Circuits (ledger is already unbounded; filter year in TS or show career — Tech Plan: Circuits PB stays career-in-window; all-time window = all ledger).

## Scope

### RPCs

| RPC | Role |
|---|---|
| `get_profile_all_time_rollups(p_tz)` | Year buckets since first finished session: mix, tonnage, pr pairs, rir0 num/den, session_count, duration_ms. Mix precedence **identical** to `mixSlice()` — shared fixture vectors. |
| `get_volume_by_muscle_group_all_time` | Same 13-axis JSON, **no** day clamp. Do not change `get_volume_by_muscle_group` 365 cap used by History. |

No prior-period fields on rollups.

### Hook

Separate react-query key from 200d/730d. Switching to Toujours does not fetch all `set_logs`. Switching back to 30j uses cached 200d.

### UI

`includeDeltas: false`: hide vs-préc. on pulse, Mix, Records, Tonnage, Équilibre score. Grain = year (Mix categories = years, not 52 weeks). Regulars on Toujours slice career logs (T232 — same window, not a frozen 100d). Hero hop uses all-time distinct programs in career if `kind === all` (glossary: current window).

### Tests

- Mix SQL buckets match TS `mixSlice` on shared vectors
- All-time path does not call `get_profile_snapshot` with a huge range
- History `useVolumeDistribution(30)` still clamps; unbounded RPC is Profil-only
- 365 Mix still month grain (regression)

## Out of Scope

- Raising History’s volume clamp
- Offline cache
- Deltas on all-time (explicitly none)

## Acceptance Criteria

- [ ] Toujours Mix is year buckets; no vs-préc. pills anywhere on the fold
- [ ] All-time Équilibre uses the unbounded volume RPC
- [ ] First paint of 7/30/100 still 200d snapshot, not the rollup
- [ ] Shared Mix vectors: TS and SQL agree
- [ ] Demoable: toggle Toujours on a long-history admin account; network tab shows rollup + unbounded volume, not a giant `set_logs` payload
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief story 4
- Tech Plan: two compute paths, prefetch, unbounded volume
