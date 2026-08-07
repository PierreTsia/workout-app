# T176 — Reporter spot-check & #463 closeout

## Goal

Manually validate the dual-program repro on real/staging data after T172–T175 land, confirm backfill sanity for the reporter setup, and close [#463](https://github.com/PierreTsia/workout-app/issues/463).

## Mode

**HITL** — requires human judgment on live session weights and historical backfill quality.

## Slice

Manuel : PWA session (pré-session + in-session) + spot SQL/backfill check + GH issue

## Dependencies

T173, T174, T175 (and thus T172).

## Scope

Run and record:

1. **Repro fix** — Alterner programme maison léger (rowing ~8kg) puis séance salle : suggestion / préremplissage salle restent sur l’ancre lourde (± **Progression Rule**), pas 8kg.
2. **Prefill parity** — Ligne “dernière fois” et poids prérempli cohérents avec la suggestion pour le slot salle.
3. **Backfill spot-check** — Sur un sample (staging ou compte reporter) : solos uniques jour/exo ont `workout_exercise_id` ; jours ambigus restent NULL.
4. **Closeout** — Commenter #463 avec résultats ; fermer l’issue si OK (ou filer bugs bloquants).

## Out of Scope

- New features ; fork-program inheritance ; pedagogical UI ; block progression

## Acceptance Criteria

- [ ] Repro HITL pass documented (notes or issue comment)
- [ ] Prefill parity HITL pass documented
- [ ] Backfill spot-check documented (attached / null counts OK)
- [ ] #463 closed or blocking follow-ups filed

## References

- Epic Brief success measures (stories 1, 3–4, 9)
- Tech Plan test plan § Manual
- Issue #463
