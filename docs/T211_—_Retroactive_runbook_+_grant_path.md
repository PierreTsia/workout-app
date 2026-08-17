# T211 — Retroactive runbook + grant path

## Goal

Make post-migrate catch-up explicit and keep the existing session-finish → `check_and_grant_achievements` path covered so circuit tiers grant like other tracks without blocking finish. Addresses Epic stories 9, 10, 14. Stories: 9, 10, 14.

## Mode

AFK — document + regression tests; no new product behavior.

## Slice

`scripts/retroactive-badge-grant.sql` (runbook/AC) → `syncService.test.ts` → docs note in PR/ticket

## Dependencies

T209 (RPCs must expose the new metrics before retroactive grant is meaningful).

## Scope

### Retroactive

| Item | Detail |
|---|---|
| Script | Existing `file:scripts/retroactive-badge-grant.sql` — call after migrate (local + prod ops) |
| Ticket/PR note | One-line runbook: migrate → run script (service role / trusted) → optional next finish for overlay |
| Behavior | Silent `user_achievements` inserts; overlay not required for catch-up (Realtime gate) |

### Ops runbook (post-migrate)

After applying the **#482** migration, run `scripts/retroactive-badge-grant.sql` once (SQL Editor / service role). Idempotent; silent grants. Overlay not required for catch-up — optional next session finish still grants remaining tiers via the normal RPC path.

### Grant path regression

| File | Change |
|---|---|
| `file:src/lib/syncService.test.ts` | Keep/strengthen: finish calls RPC with `p_user_id`; RPC failure does not fail finish; unlocked rows push queue + `lastSessionBadgesAtom` |
| `file:src/lib/syncService.ts` | **No code change** unless a bug is found |

## Out of Scope

- Running the script against prod (human/ops in T212)
- Changing overlay UX
- New grant trigger beyond session finish

## Acceptance Criteria

- [x] PR description or ticket checklist includes: run `scripts/retroactive-badge-grant.sql` after applying the #482 migration
- [x] `syncService` tests still assert RPC-on-finish, non-critical failure, and queue/`lastSessionBadgesAtom` push
- [x] No change that makes badge RPC failure fail `processSessionFinish`
- [x] Vitest for syncService green with `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY=`

## References

- Tech Plan: `file:docs/Tech_Plan_—_Benchmark_Circuit_achievement_tracks_#482.md` (retroactive decision)
- Script: `file:scripts/retroactive-badge-grant.sql`
- Grant: `file:src/lib/syncService.ts`
- Epic stories 9, 10, 14
