# T232 — Regulars follow the window

## Goal

Wire **Récurrents** to the same Profil window as the rest of the fold: rank by total numeric reps per catalog `exercise_id` in that window, tie-break `max(logged_at)`, ≥2 sessions to appear, top ~8, Circuit stations count. No Program pin. Addresses Epic story 15. The old “100d always / ignore the toggle” lock is **revoked** (HITL T0).

## Mode

AFK — window follow and reps ranking are HITL-locked.

## Slice

`lib/profile/regulars` on the snapshot (slice `from`/`to`, not a frozen 100d) → Regulars block → vitest (≥2 floor, Circuit stations, 7j ≠ 100j)

## Dependencies

T227 (200d snapshot covers 7 / 30 / 100 + prior). Kind **365** uses the 730d fetch. Kind **all** waits on T234 career logs — do not invent a 100d list when the cran is Toujours. T225 shell.

## Scope

### Algo

- Distinct window = current `ProfileWindow.kind` (`from`/`to`)
- Rank = sum of numeric reps in the window (duration-only last)
- Tie-break `max(logged_at)`
- ≥2 distinct sessions in the window to appear (once is not a habit)
- Top ~8
- Circuit station logs count
- No `Sur le programme` / `Hors plan` pills

The 200d prefetch already contains 7 / 30 / 100. Do not add a dedicated Regulars RPC.

### UI

Replace Regulars fixture adapter (`file:src/lib/profile/regulars.ts` + `file:src/components/profile/RegularsBlock.tsx`). Subtitle `Les plus loggés · {{window}}`. Empty: no rows (not a fake top-8).

### Tests

- Toggle 7j vs 100j **changes** Regulars order and counts
- One-session exercise absent; two-session present
- Cindy pull-ups can rank
- No Program annotation in the list

## Out of Scope

- Changing snapshot range (stay 200d / 730d)
- Reintroducing Program pins
- Reintroducing a frozen 100d window

## Acceptance Criteria

- [ ] Regulars use the current window, not a fixed 100d
- [ ] Exercises with a single session in the window do not appear
- [ ] Circuit stations contribute reps
- [ ] Demoable: switch 7j → 100j; the list and the lead number move
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief story 15
- Tech Plan: same-window Regulars, prefetch 200d
- Glossary: **Regulars**
