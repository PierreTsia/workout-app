# T218 — HITL pixel-perfect ceremony closeout

## Goal

Human-compare the real overlay (via `/_unlock-overlay`) to the v2 Stitch PNGs. This is the epic’s visual gate. Stories: 3–6, 15–17.

## Mode

HITL — subjective pixel-perfect judgment against the gist screens. Agents cannot sign this off.

## Slice

playground → eyeball vs PNGs → notes on #491 / PR

## Dependencies

T214, T215, T216, T217

## Scope

### Setup

1. Branch with T213–T217 merged (or stacked locally).
2. Log in, open `/_unlock-overlay`.
3. Keep the gist PNGs side-by-side: https://gist.github.com/PierreTsia/1cf2af5c3010f43a5625cac5f3ab78e9

### Checklist (eyeball)

| Check | Pass |
|---|---|
| Gold single vs `unlock-moment-single-gold-v2.png` — medal size, eyebrow, title, metal chip + Volume sibling, threshold on the **next** line, Equip teal, dark `#0f0f13` veil | |
| Burst 4 vs `unlock-moment-burst-4-v2.png` — Diamond hero, three supporting with captions, not a 2×2, Equip present | |
| 2 overlap — Silver hero, Bronze satellite bottom-right, copy is Silver’s | |
| Overflow 5+ — `+N` last slot, no carousel | |
| Bronze → Platinum singles — metal color on chip/glow only; backdrop never recolored | |
| Equip on Gold → toast, overlay stays; tap dismisses | |
| Escape / tap-continue dismisses without equip | |
| Reduced-motion OS setting → static, no rain | |
| Diamond particles behind type, one burst, not infinite rain | |
| FR locale: threshold line doesn’t collide with chip row | |

### Outcome

- Comment on #491 or the PR: pass / nits / blockers.
- File follow-ups only for real visual bugs, not “maybe more glitter.”

## Out of Scope

- Redesigning the badge drawer
- Changing rank thresholds or icon assets
- Shipping a public design-system site

## Acceptance Criteria

- [ ] Checklist completed on local or preview
- [ ] Gold single and burst 4 compared to the v2 PNGs (pixel-perfect bar, not vibe)
- [ ] 2-overlap and 5+ overflow explicitly checked
- [ ] #491 / PR updated: HITL done or blockers listed

## References

- Epic Brief success criteria
- Stitch v2 gist
- Playground: T217 `/_unlock-overlay`
