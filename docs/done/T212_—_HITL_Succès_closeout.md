# T212 — HITL Succès closeout

## Goal

Human-verify the five circuit tracks on a real (or local seeded) history: accordion copy, Cast Clearing `MIN`, Spidey Holland 27, empty TIME / forks excluded, and retroactive grant after migrate. Closes Epic success criteria qualitatively. Stories: 1–17 (verification).

## Mode

HITL — requires eyeballing Succès / history against real data and judging edge cases the arch tests cannot see.

## Slice

local migrate → retroactive script → PWA Succès + session finish overlay → checklist

## Dependencies

T210, T211 (guards + runbook in place).

## Scope

### Setup

1. Branch with T209–T211 merged (or stacked).
2. `supabase db reset` / apply migration.
3. Run `scripts/retroactive-badge-grant.sql` for the test user.
4. Optional: `npm run seed:circuit-history -- --user-id=…` — **know** that local seed labels can inflate runner; prefer known hand-run Cindy/Pantheon fixtures when asserting exact counts.

### Checklist (eyeball)

| Check | Pass |
|---|---|
| Accordion shows 5 new groups, sort after Early Bird, locked titles FR/EN | |
| `groupDescriptions` / drawer hints are real strings (no raw keys) | |
| Circuit runner increments on qualifying seed runs only | |
| Spidey `current_value` = Cindy PB full rounds; diamond at ≥27; `26+N` does not diamond | |
| Olympians/Heroes/Pantheoniste = MIN; Zeus spam alone does not raise clearing | |
| Missing cast seed keeps clearing at 0 | |
| TIME empty / `fullRounds = 0` grants nothing | |
| Circuit Fork / jetable AMRAP ignored | |
| Catalog `/library/circuits` has no badge chips | |
| Post-finish overlay can unlock newly earned tiers; finish works if RPC mocked fail (spot-check) | |
| Retroactive: tiers already earned appear on Succès without requiring a new run (after script) | |

### Outcome

- Comment on #482 or PR with pass/fail notes.
- File follow-ups only for real bugs (not copy polish unless broken).

## Out of Scope

- Badge art, bottleneck UI, voice rewrite of descriptions
- Leaderboards / catalog chrome
- Changing thresholds or titles

## Acceptance Criteria

- [ ] Checklist above completed on local (or staging) with notes
- [ ] At least one Spidey diamond-boundary check (27 unlocks / 26 does not)
- [ ] At least one Cast Clearing missing-seed → 0 check
- [ ] Catalog confirmed badge-free
- [ ] Retroactive script run once and Succès reflects history
- [ ] #482 / PR updated: HITL done or blockers listed

## References

- Epic Brief success criteria: `file:docs/Epic_Brief_—_Benchmark_Circuit_achievement_tracks_#482.md`
- Tech Plan failure modes: `file:docs/Tech_Plan_—_Benchmark_Circuit_achievement_tracks_#482.md`
- ADR 0019: `file:docs/adr/0019-circuit-achievement-cast-clearing-and-spidey.md`
- Seed hygiene: `file:scripts/seed-local-history.ts`
