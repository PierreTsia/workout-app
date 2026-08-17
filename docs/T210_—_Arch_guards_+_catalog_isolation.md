# T210 — Arch guards + catalog isolation

## Goal

Prove in CI that the #482 migration keeps the security-definer / metric contract and that the **Circuit Catalog** does not grow badge chrome. Addresses Epic stories 8 and 11 (forks/seeds filter in SQL; catalog stays encyclopedia). Stories: 8, 11.

## Mode

AFK — mechanical assertions.

## Slice

`securityDefiner.arch.test.ts` (+ catalog isolation test) → vitest

## Dependencies

T209 (migration file must exist on the branch).

## Scope

### Arch assertions (extend existing file)

Target migration: the new `*_circuit_achievement_tracks.sql` (or whatever timestamp lands in T209).

| Assert | Why |
|---|---|
| Both RPC names still in `SECURITY_DEFINER_FUNCTIONS` / auth-guard signals | Regression |
| SQL contains metric_type literals: `circuit_runner`, `spidey`, `olympians`, `heroes`, `pantheoniste` | Wiring |
| SQL contains `owner_id IS NULL` near benchmark join | Seed-only |
| SQL contains fixed cast slugs (`zeus`…`hades`, heroes, pantheon) | Cast Clearing |
| SQL shows LEFT JOIN / unnest slug-list pattern for casts (string markers agreed in implementation) | Missing seed → 0 |

### Catalog isolation

| Assert | Why |
|---|---|
| `CircuitCatalogPage` / `CircuitCatalogSeedPage` (and related library circuit components) do not import `@/hooks/useBadgeStatus`, achievement atoms, or `SessionBadges` | ADR 0018 |

Prefer a small grep/arch test over brittle full-file snapshots.

## Out of Scope

- Implementing metrics (→ T209)
- HITL eyeball (→ T212)
- Changing catalog UI

## Acceptance Criteria

- [ ] Arch test fails if any of the five `metric_type` strings is removed from the migration
- [ ] Arch test fails if `owner_id IS NULL` guard is removed from the circuit join path
- [ ] Arch test fails if catalog circuit pages import badge status/overlay modules
- [ ] `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run src/test/securityDefiner.arch.test.ts` (and any new isolation test file) green

## References

- Tech Plan: `file:docs/Tech_Plan_—_Benchmark_Circuit_achievement_tracks_#482.md` (tests decision)
- ADR 0018: `file:docs/adr/0018-circuit-catalog-encyclopedia-under-library.md`
- Arch precedent: `file:src/test/securityDefiner.arch.test.ts`
- Catalog: `file:src/pages/library/CircuitCatalogPage.tsx`, `file:src/pages/library/CircuitCatalogSeedPage.tsx`
