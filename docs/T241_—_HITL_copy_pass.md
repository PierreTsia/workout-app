# T241 — HITL copy pass

## Goal

Review **Program Score Copy** on the real **Program Page** and Library cards. Tighten coach voice; keep track names and band labels. Addresses Epic stories 5, 21.

## Mode

HITL — the sentences exist from the i18n contract, but you cannot judge “coach vs glossary leak” until the page is filled with a real week (PPL, 5×5, Cindy, empty).

## Slice

live Program Page + cards → grep locales → edit `program.json` EN/FR only → vitest i18n keys still resolve

## Dependencies

T240.

## Scope

### What you look at

Open `/programs/:id` on at least: a PPL-shaped week, a 5×5-shaped week, Cindy-only, empty. Scan Library cards on the same programs.

Check:

- Rubric sentences read as a coach, not a spec
- Tap example (`example.hypertrophy` and any siblings shipped in T240) uses *this* week’s facts
- Empty / offline / 404 strings still match the product voice
- **Répartition** never appears; Program Balance is EN **Balance** / FR **Équilibre**

### Allowed edits

- Tighten `rubric.*`, `example.*`, `empty.scores`, `offline`, `loadError` wording in `file:src/locales/en/program.json` and `file:src/locales/fr/program.json`
- Fix interpolation if a sentence is awkward with real numbers

### Forbidden

- Renaming tracks (`track.hypertrophy` stays Muscle growth / Prise de masse; `track.balance` stays Balance / Équilibre)
- Changing `bands.ts` numbers to “make copy easier”
- Adding keys that invent a fourth Goal Track or a Start CTA
- Shipping glossary in UI: Exercise Slot, Template Prescription, Goal Track, CV, log1p, `rep_range_max`, intent, taxonomy

### Tests

- Grep `src/locales/` for the forbidden tokens above — count is 0
- Existing page/card tests still pass (keys not deleted)

## Out of Scope

- Scorer math (T238)
- ADR (T242)
- Builder banner (#519)

## Acceptance Criteria

- [ ] You have signed off on the four rubric sentences + one tap example against a real week (HITL — Pierre)
- [ ] 0 glossary leaks in `src/locales/**/*.json` for the forbidden list
- [ ] Track names and band labels still match the Tech Plan contract (or a documented one-word fix you approved)
- [ ] FR uses Équilibre for Program Balance; Répartition is absent from `program.json`
- [ ] Env-stripped vitest still green

## References

- Epic Brief stories 5, 21
- Tech Plan i18n contract
- Glossary: **Program Score Copy**, **Program Score Rubric**
