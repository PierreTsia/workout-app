# T235 — Docs: five Profil windows

## Goal

Align the banked vision, copy deck, and GitHub #512 with the grilled five windows (7j / 30j / 100j / 1 an / Toujours) so Built in public and the issue body do not still say 7/30/100-only. Addresses Epic story 25 (docs half; glossary already in CONTEXT).

## Mode

AFK — product copy and grains are locked; this is editorial catch-up.

## Slice

`Vision_—_Profil_dashboard.md` → copy-deck canvas strings → issue #512 body → (optional) comment that Circuit tonnage **is** in

## Dependencies

None. Can land anytime; ideally after T225 so UI labels match docs.

## Scope

### Vision

`file:docs/Vision_—_Profil_dashboard.md`: replace 7/30/100-only toggle tables with five crans, grains (day / ISO week / ISO week / month / year), all-time **no deltas**, Regulars **follow the window**, prefetch 200d / 730d.

### Copy deck

`file:docs/visions/profile-copy-deck.canvas.tsx`: fifth toggle label **Toujours** / **All time**; hop / delta copy that must not appear on all-time.

### GitHub

Update [#512](https://github.com/PierreTsia/workout-app/issues/512) body so Mix is frozen and windows are five. Do not leave “unfrozen Mix” or 7-30-100 as the issue SSOT.

If an older comment says Circuit sets are out of Tonnage, add a short correction: loaded Circuit sets **count**.

## Out of Scope

- Rewriting the Epic Brief / Tech Plan (already current)
- Implementation
- Blog post

## Acceptance Criteria

- [ ] Vision toggle section lists 7j / 30j / 100j / 1 an / Toujours with locked grains
- [ ] Copy deck includes Toujours and does not promise vs-préc. on all-time
- [ ] Issue #512 body matches the brief (five windows, Mix precedence, Tonnage includes loaded Circuit sets)
- [ ] No new product decisions — if a sentence still argues 7/30/100-only, it is a bug in this ticket

## References

- Epic Brief story 25
- Tech Plan grain / prefetch tables
- `file:docs/CONTEXT.md` glossary (already updated)
