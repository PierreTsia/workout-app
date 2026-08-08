# T176 — Reporter spot-check & #463 closeout

## Goal

Manually validate the dual-program repro on real/staging data after T172–T175 land, confirm legacy solos stay unattached (template bootstrap), and close [#463](https://github.com/PierreTsia/workout-app/issues/463).

## Mode

**HITL** — requires human judgment on live session weights and null-FK bootstrap behavior.

## Slice

Manuel : PWA session (pré-session + in-session) + spot SQL (legacy nulls) + GH issue

## Dependencies

T173, T174, T175 (and thus T172).

## Scope

Run and record:

1. **Repro fix** — Alterner programme maison léger (rowing ~8kg) puis séance salle : suggestion / préremplissage salle restent sur l’ancre lourde (± **Progression Rule**), pas 8kg. (Needs at least one completed post-deploy session per slot so the FK is set.)
2. **Prefill parity** — Ligne “dernière fois” et poids prérempli cohérents avec la suggestion pour le slot salle.
3. **Legacy null spot-check** — Sur un sample (staging ou compte reporter) : pre-migration solos still have `workout_exercise_id` NULL; first post-deploy session for a slot bootstraps from **Template Prescription** (not a guessed historical attach).
4. **Closeout** — Commenter #463 avec résultats ; fermer l’issue si OK (ou filer bugs bloquants).

## Out of Scope

- New features ; fork-program inheritance ; pedagogical UI ; block progression

## Acceptance Criteria

- [ ] Repro HITL pass documented (notes or issue comment)
- [ ] Prefill parity HITL pass documented
- [ ] Legacy null / template-bootstrap spot-check documented
- [ ] #463 closed or blocking follow-ups filed

## References

- Epic Brief success measures (stories 1, 3–4, 9–10)
- Tech Plan test plan § Manual
- Issue #463
