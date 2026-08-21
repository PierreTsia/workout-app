# T237 — HITL T0 mocked fold

## Goal

Eyeball `/profile` on **fixtures only** (Pierre data, empty, loading) before any live RPC. This is the mocked-screen review: density, act order, empties vs skeletons, five-window chrome. Wiring (T227+) waits on a pass. Addresses Epic stories 17, 20 (visual), 21 (charts in situ).

## Mode

HITL — T225 can merge AFK; this ticket is you on a phone-width viewport with the admin fixture switch. Copy/layout nits that need a human, not another grill.

## Slice

T225 `/profile` (admin) → fixture switch Pierre / empty / loading → checklist on 7j + wrap on 5 toggles → comment on #512 or the T225 PR

## Dependencies

T225 (and thus T224). **Gates T227 and T233.** T226 / T235 may continue in parallel.

## Scope

### Setup

1. Branch with T224–T225 merged (or stacked). Admin user.
2. Open `/profile` (PWA or Chrome device mode ≤390px, then desktop).
3. Use the T225 admin switch: Pierre-shaped / all empty / all loading. Do not need real `set_logs`.

### Checklist (eyeball)

| Check | Pass |
|---|---|
| Three acts in order; Mix + Rythme **above** Records | |
| Five toggles readable; wrap on mobile, not a clipped 5th cran | |
| Toujours: no vs-préc. pills on the fixture VM | |
| Pierre fixture: charts look like *a* dashboard (stacked Mix, dual-axis combo, 13-axis radar) — not pixel-canvas | |
| Combo: no green/red; a missing RIR point is a gap, not `0%` | |
| Empty switch: empties are copy, not skeletons, not fake series | |
| Loading switch: skeletons, not `"–"` | |
| 2-session / not-enough fixture: Équilibre empty; pulse/Mix may still show | |
| Cindy fixture: Mix **Circuits**, Tonnage empty or 0 t | |
| Tonnage sits beside radar on desktop, stacked under on mobile | |
| Récurrents / Circuits / Succès don’t feel like a fourth product | |
| Identity card in the drawer still goes to `/account` | |
| Non-admin still has no nav row (spot-check) | |

File follow-ups only for real layout/copy bugs. Do not reopen Mix precedence or metric definitions here.

### Outcome

- Comment on [#512](https://github.com/PierreTsia/workout-app/issues/512) or the T225 PR: pass, or blockers with screenshots.
- T227 must not start until this is **pass** or blockers are filed as separate tickets (not silent “fix while wiring”).

## Out of Scope

- Live snapshot / wiring (T227+)
- Ungate (T236) — that’s a second HITL on **real** data
- Rewriting chart atoms unless a checklist row fails (then a patch on T224/T225)

## Acceptance Criteria

- [ ] Checklist completed on mobile-width and desktop
- [ ] Pierre + empty + loading each signed off (or blockers listed)
- [ ] #512 / PR updated: HITL done or blockers filed
- [ ] No wiring PR opened until this ticket is pass or explicitly waived in the comment

## References

- Epic Brief stories 17, 20–21
- T225 fixtures; Tech Plan T0 admin switch
- Copy: `file:docs/visions/profile-copy-deck.canvas.tsx`
