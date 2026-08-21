# T227 — Snapshot RPC + pulse wiring

## Goal

First live vertical slice: `get_profile_snapshot` + `useProfileSnapshot` (200d first paint, 730d on 1 an) and the pulse strip (Séances, **Session time**, Durée moy. vs prescribed) derived from that snapshot. Other blocks may stay on T225 fixtures. Addresses Epic stories 8, 18, 22, 23 (pulse).

## Mode

AFK — RPC shape, prefetch, and “never bind `get_training_activity_by_day.minutes`” are locked.

## Slice

migration `get_profile_snapshot` → `useProfileSnapshot` → `lib/profile` pulse VMs → pulse `ProfileSection` → vitest (duration fallback, empty strip, forbidden binding)

## Dependencies

T225 (shell + fixture adapter to replace for pulse only). **T237** (mocked-fold HITL pass — do not start wiring on a fold that failed eyeball).

## Scope

### RPC

`get_profile_snapshot(p_from date, p_to date, p_tz text)` → `{ sessions, sets }` as Tech Plan **Table Notes**. SECURITY INVOKER, `user_id = auth.uid()`. Session facts include `program_id` (from `workout_days`, nullable) and `has_catalog_circuit` for later Mix/hop tickets.

Client fetches **200d** for kinds 7 / 30 / 100 (slice in TS, including prior window for deltas). Kind **365** fetches **730d**. Kind **all** is still fixtures or a no-op until T234 — do not dump lifetime `set_logs` here.

### Hook + lib

- `file:src/hooks/useProfileSnapshot.ts`: query keys for 200d vs 730d. Blocks do not each `useQuery` the session list.
- Pulse algos in `file:src/lib/profile/`: session count, `SUM(active_duration_ms)` with wall-clock fallback like `get_cycle_stats`, mean duration vs `users.session_duration_minutes`. Deltas vs equal prior window when `includeDeltas`.
- Link Durée moy. comparison to `/account` (form that edits prescribed duration).

### Pulse UI

Replace the T225 pulse fixture adapter with live VMs. Zero sessions in window → whole strip empty (not “0 min vs 60 prescrits”). RPC error → pulse error slot, not a silent nearby aggregate.

### Tests

- Snapshot types; duration fallback when `active_duration_ms` is null
- Empty window → strip `status: 'empty'`
- Arch or unit: pulse source is snapshot duration, **not** `get_training_activity_by_day`

## Out of Scope

- Mix / Rythme / Records wiring (T228, T229)
- All-time rollup RPC (T234)
- Ungate (T236)

## Acceptance Criteria

- [ ] Migration ships `get_profile_snapshot`; RLS/invoker = current user only
- [ ] First paint for 7/30/100 uses one 200d query, not one fetch per block
- [ ] Toggle **1 an** triggers 730d fetch; 7/30/100 stay on the 200d cache
- [ ] Pulse numbers match `SUM(active_duration_ms)` (+ fallback); tests fail if wired to `minutes` from activity-by-day
- [ ] 0 sessions in window: empty strip, not vs-prescribed zeros
- [ ] Demoable: admin on real data sees Séances / Temps sous barre / Durée moy. move with 7j vs 30j
- [ ] Env-stripped vitest + `npx tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 8, 18, 22–23
- Tech Plan: snapshot RPC, prefetch, pulse constraints
- Glossary: **Session time**, **Prescribed session duration**
