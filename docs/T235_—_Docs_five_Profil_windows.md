# T235 — Docs: five Profil windows

**Status:** leftover editorial. **Not the AFK frontier.** Do not start this before T227 / T233.

Vision, CONTEXT, Epic Brief, Tech Plan, and the #512 body are already on the HITL locks (five windows, Mix frozen, Regulars follow the window, Temps de séance, Tonnage includes loaded Circuit sets). The Tonnage correction comment is already on #512.

## Goal

Catch the **copy-deck canvas** up to the grilled five windows and HITL copy so Built in public does not still show the revoked Regulars-100d / Temps sous barre sentences. Addresses Epic story 25 (docs half).

## Mode

AFK — product copy and grains are locked; this is editorial catch-up.

## Slice

`docs/visions/profile-copy-deck.canvas.tsx` only (Vision / #512 body already current)

## Dependencies

None technically. **Do not schedule as the first ticket.** Frontier after T237 pass is T227 ∥ T233.

## Scope

### Copy deck

`file:docs/visions/profile-copy-deck.canvas.tsx`: fifth toggle **Toujours** / **All time**; hop / delta copy that must not appear on all-time; Regulars follow the window (not “100d always”); pulse label **Temps de séance** / **Session time**; Circuits row = run count + best in window. Do not invent new product copy — match `file:src/locales/{en,fr}/profile.json`.

### Already done (do not rewrite)

- `file:docs/Vision_—_Profil_dashboard.md` — five crans, grains, Regulars follow the window
- `file:docs/CONTEXT.md` glossary
- Epic Brief / Tech Plan
- [#512](https://github.com/PierreTsia/workout-app/issues/512) body + Tonnage correction comment + T237 pass comment

## Out of Scope

- Rewriting the Epic Brief / Tech Plan / Vision / #512 body
- Implementation
- Blog post
- Starting T227 / T233 from this ticket

## Acceptance Criteria

- [x] Vision toggle section lists 7j / 30j / 100j / 1 an / Toujours with locked grains
- [ ] Copy deck includes Toujours and does not promise vs-préc. on all-time (or Regulars-100d / Temps sous barre)
- [x] Issue #512 body matches the brief (five windows, Mix precedence, Tonnage includes loaded Circuit sets, Regulars follow the window)
- [ ] No new product decisions — if a sentence still argues 7/30/100-only or Regulars-always-100d, it is a bug in this ticket

## References

- Epic Brief story 25
- Tech Plan grain / prefetch tables
- `file:docs/CONTEXT.md` glossary (already updated)
- HITL locks: `file:docs/done/T237_—_HITL_T0_mocked_fold.md`
