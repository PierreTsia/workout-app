# T221 — Retroactive runbook + grant path

## Goal

Make post-migrate catch-up explicit for #509 and keep the existing session-finish → `check_and_grant_achievements` path covered so Bodyweight Trinity tiers grant like other tracks without blocking finish. Addresses Epic stories 16, 19.

## Mode

AFK — document + regression tests; no new product behavior.

## Slice

`scripts/retroactive-badge-grant.sql` (header comment) → `syncService.test.ts` → ticket/PR runbook

## Dependencies

T220 (RPCs must expose the new metrics before retroactive grant is meaningful).

## Scope

### Retroactive

| Item | Detail |
|---|---|
| Script | Existing `file:scripts/retroactive-badge-grant.sql` — call after migrate (local + prod ops). **Do not** invent a second script |
| Header comment | Add a `#509` stanza next to the existing `#482` runbook: same script, run once after the Bodyweight Trinity migration |
| Behavior | Silent `user_achievements` inserts; overlay not required for catch-up (Realtime gate). **Live chain:** a broken historical 100-day island does **not** grant `hundred_a_day` diamond — that is the Tech Plan lock, not a script bug |
| Ticket/PR note | One-line runbook: migrate T220 → run script (service role / trusted) → optional next finish for overlay |

### Grant path regression

| File | Change |
|---|---|
| `file:src/lib/syncService.test.ts` | Keep/strengthen: finish calls RPC with `p_user_id`; RPC failure does not fail finish; unlocked rows push queue + `lastSessionBadgesAtom` |
| `file:src/lib/syncService.ts` | **No code change** unless a bug is found |

## Out of Scope

- Running the script against prod (human/ops in T222)
- Changing overlay UX or `hundred_a_day` to MAX
- One-shot SQL to grant from historical max streak (Tech Plan escape hatch — not this epic)
- Badge art (T223)

## Acceptance Criteria

- [ ] `scripts/retroactive-badge-grant.sql` header documents #509 (and still #482)
- [ ] PR description or ticket checklist includes: run that script after applying the Bodyweight Trinity migration
- [ ] `syncService` tests still assert RPC-on-finish, non-critical failure, and queue/`lastSessionBadgesAtom` push
- [ ] No change that makes badge RPC failure fail `processSessionFinish`
- [ ] Vitest for syncService green with `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY=`

## References

- Tech Plan: `file:docs/Tech_Plan_—_Bodyweight_Trinity_achievement_tracks_#509.md` (retroactive + live-chain Table Notes)
- Script: `file:scripts/retroactive-badge-grant.sql`
- Grant: `file:src/lib/syncService.ts`
- Precedent: `file:docs/done/T211_—_Retroactive_runbook_+_grant_path.md`
- Epic stories 16, 19
