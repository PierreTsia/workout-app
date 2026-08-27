# T247 — HITL stitch closeout

## Goal

Human recette of the Hevy-class canvas against `file:web/stitch/builder-503/` (visual floor, not pixel-slave) plus a glossary-leak check so shipped `builder` copy says **Circuit**, never “block”, and never leaks **Exercise Slot** / **Template Prescription**. Story 22.

## Mode

HITL — an agent can prepare the grep and the walkthrough notes; sign-off needs a human looking at empty day, mobile two-line row, and Circuits chrome.

## Slice

Locale grep → local PWA walkthrough (week list → editor → inline 4×8 → `⋯` → one Add) → comment on #503

## Dependencies

T243, T245, T246 (T244 is implied by T245). Recette the stacked branch, not a lone ticket.

## Scope

### AFK prep (do this first)

Grep `file:src/locales/en/builder.json` and `file:src/locales/fr/builder.json` for glossary leaks in keys **this epic touched** (and any leftover page-level `createBlock` still rendered). Fail the ticket if UI still shows “block”, “Exercise Slot”, or “Template Prescription”. FR **tu** on keys this epic rewrote (`noExercises`, `newCircuitHint`); do **not** rewrite untouched *vous* leftovers (`offlineDescription`).

Stitch is the floor: `file:web/stitch/builder-503/week-list.html`, `day-editor.html`, `picker.html`. Match glance, density, one Add, quiet empty — not pixel-perfect.

### Checklist (eyeball)

| Check | Pass |
|---|---|
| Week list: mini **Body Map** per day with slots; no grey “N exercises”; pick a day by silhouette | |
| Editor: live map + chips; Cindy does not look like a 50-set pec day | |
| Empty day: map hidden, quiet copy, **one** Add | |
| Solo row: 4×8 (or hold) inline; two-line on a 375px viewport; no permanent trash | |
| `⋯`: ranges / instructions; delete confirm; admin catalog link only if admin | |
| **BlockCard**: `⋯` → Edit circuit / Remove; per-round still in **BlockEditor** | |
| One Add: Exercises multi-select **Add N**; already-on-day badged; Cindy search punch-through | |
| Circuits: seed tap-to-drop; **New circuit** → ≥2 → create; no page-level **Create circuit** | |
| Header: rename, Activate, **Saved** / **Syncing failed** still work | |
| Offline gate still blocks authoring | |
| Reorder solos + Circuits together still works | |
| FR + EN: **Circuit** never “block”; no slot / prescription leaks | |
| No **Program** scores / #519 banner on the **Builder** | |
| No **Embedded Agent** on this screen | |

### Outcome

- Comment on [#503](https://github.com/PierreTsia/workout-app/issues/503) (or the PR) with pass/fail notes.
- File follow-ups only for real bugs, not Stitch pixel deltas.

## Out of Scope

- Pixel-slave to Stitch
- AI insight, clone-to-self, marketplace, live score banner (#519)
- Rewriting **Program Page** scores
- New product / copy beyond the Tech Plan contract

## Acceptance Criteria

- [ ] Checklist completed on local (or staging) with notes
- [ ] 0 glossary leaks in shipped `builder` strings this epic owns
- [ ] Empty state is quiet (not a CMS blank); exactly one primary Add
- [ ] Mobile two-line row is usable (fields tappable, not a 7-cell overflow)
- [ ] #503 / PR updated: HITL done or blockers listed

## References

- Epic Brief stories 17, 19, 20, 22 and Success Criteria
- Tech Plan i18n contract + Copy law + Rejected list
- Visual floor: `file:web/stitch/builder-503/`
- ADR `file:docs/adr/0021-builder-one-add-picker.md`
- Precedent: `file:docs/T222_—_HITL_playground_+_Succès_closeout.md`
