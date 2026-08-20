# T208 — Pin AMRAP score contract

## Goal

Lock the **Circuit Achievement Run** / Spidey round formula in Vitest so the #482 SQL CTE cannot silently diverge from `amrapScore`. Addresses Epic stories 3 and 7 (fullRounds gate, Holland tiers) as a test oracle before the migration lands. Stories: 3, 7 (contract only).

## Mode

AFK — mechanical fixtures; no product judgment.

## Slice

`amrapScore.test.ts` → documented SQL parity comments (no UI)

## Dependencies

None.

## Scope

### Fixtures to pin (or strengthen if already present)

| Case | Expected |
|---|---|
| Finished run, leftover on set_number N | `fullRounds = N - 1` |
| Unfinished (`finished_at` null) | `amrapScore` → `null` |
| Finished with max set_number = 1 only | `fullRounds = 0` (excluded from qualifying in T209) |
| Cindy-shaped 27+3 | `fullRounds = 27`, leftover ignored for tier identity |
| Tie on set_number | leftover cell = max `logged_at` (existing behavior; document for SQL authors that **tiers** only need `MAX(set_number)-1`) |

### Files

| File | Change |
|---|---|
| `file:src/lib/amrapScore.test.ts` | Add/strengthen cases above; short comment block: “#482 RPC `qualifying_runs` must match `fullRounds = MAX(set_number) - 1`” |
| `file:supabase/functions/mcp/lib/amrapScore.ts` | **Do not** change unless a fixture proves drift — out of scope to re-sync Edge here |

## Out of Scope

- Any SQL / migration (→ T209)
- i18n, accordion, retroactive grant
- Changing `amrapScore` production behavior

## Acceptance Criteria

- [ ] Vitest covers finished → `fullRounds = max(set_number) - 1`
- [ ] Vitest covers unfinished → `null`
- [ ] Vitest covers `fullRounds === 0` for a finished single-set leftover round
- [ ] Comment in the test file points T209 authors at the SQL contract
- [ ] `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run src/lib/amrapScore.test.ts` green

## References

- Epic Brief: `file:docs/Epic_Brief_—_Benchmark_Circuit_achievement_tracks_#482.md` (stories 3, 7)
- Tech Plan: `file:docs/Tech_Plan_—_Benchmark_Circuit_achievement_tracks_#482.md` (fullRounds inline CTE)
- ADR: `file:docs/adr/0019-circuit-achievement-cast-clearing-and-spidey.md`
- Score: `file:src/lib/amrapScore.ts`
