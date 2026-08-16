# T196 — Circuit Fork Builder

## Goal

Persisting a fingerprint-changing edit on a **non-owned** **Benchmark Circuit** (the Cindy seed) confirms *« Ça ne sera plus Cindy. »* then mints a private catalog row (`owner_id` = user, `forked_from` = cindy, `slug` NULL) and retargets the day’s **Exercise Block**. Leftover / missed reps are not a fork. Owned private rows mutate in place. Stories 14, 15, 16, 17.

## Mode

**AFK** — dialog copy and intercept-before-persist are locked. UX glance → **T198**.

## Slice

`circuitFork` lib → intercept `useUpdateBlockMeta` / `useUpdatePerRound` → `CircuitForkDialog` (shadcn `AlertDialog`) → vitest + component tests

## Dependencies

T191 (catalog row, `templateFingerprint` vs canonical Rx). T193 should exist so tests can prove Monday’s `block_runs` stay cindy after retarget — if T193 is not merged yet, add a unit test that updates the block FK and asserts a pre-existing run row is unchanged (column may already be there).

## Scope

### Lib — `file:src/lib/circuitFork.ts`

- Compare `templateFingerprint(pending)` vs catalog canonical (from `rx`).
- If `benchmark_circuit_id` set **and** that row’s `owner_id` is not the current user **and** fingerprints differ → fork path.
- Fork: INSERT `benchmark_circuits` (copy mutated Rx, `owner_id = auth.uid()`, `forked_from`, slug NULL, story fields copied or null — Tech Plan: mutated Rx, user-owned). UPDATE day’s block `benchmark_circuit_id`.
- Owned row: persist in place (existing mutators).

### Builder

- `file:src/components/builder/CircuitForkDialog.tsx` : shadcn `AlertDialog`. FR/EN confirm. Cancel → **no write**.
- Gate **before** `useUpdateBlockMeta` / `useUpdatePerRound` mutate (`file:src/components/builder/BlockEditor.tsx`, uniform list / per-round grid). Debounce must not persist seed Rx under the seed id.
- Logging leftover in session is **not** this ticket (performance, not fork) — no runner changes.

## Out of Scope

- Publish / `visibility`. Blank named create. Fork-from-MCP (v1 Builder only unless parse already retargets — do **not** auto-fork on MCP edit of a seed instance without the dialog; MCP `update_program` wipe+insert of a generic Circuit drops FK — already specified).
- History header for the new private row (no slug/story required in v1).

## Acceptance Criteria

- [ ] Changing Cindy cap 20 → 10 in Builder → dialog ; confirm → new row `owner_id = user`, `forked_from = cindy`, `slug IS NULL`, block FK retargeted ; seed row Rx unchanged.
- [ ] Cancel → no INSERT, no block update, editor still on seed Rx.
- [ ] Leftover / fewer reps in a session does not create a fork (no Builder persist).
- [ ] Editing a private fork (own `owner_id`) does not INSERT another row.
- [ ] After fork, a `block_runs` row stamped cindy at GO (T193) still has `benchmark_circuit_id = cindy`.
- [ ] Vitest for fingerprint gate + fork insert ; component test for dialog cancel.

## References

- Epic Brief stories 14–17
- Tech Plan fork intercept, `CircuitForkDialog`
- `file:src/lib/blockTemplate.ts` `templateFingerprint`
- `file:src/hooks/useBlockMutations.ts`
