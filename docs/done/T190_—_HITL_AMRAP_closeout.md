# T190 — HITL AMRAP closeout

## Goal

Valider à la main les success measures de l’epic #474 : Cindy définie, courue, scorée, et créée par un agent — Zeus à côté n’a pas bougé ; nulle part `AMRAP` ou `27+3` nu.

## Mode

**HITL** — jugement qualité (GO/leftover feel, pédagogie du sigle, fidélité MCP). Pas de décision d’archi restante.

## Slice

Manuel : Builder + Round Screen + history sheet + client MCP externe

## Dependencies

T184, T185, T186, T187, T188, T189.

## Scope

Run and record (issue comment ou notes) :

1. **Builder Cindy** — ToggleGroup AMRAP, cap 20, 5-10-15, rest absents ; Zeus du même programme toujours Tours.
2. **Séance** — Démarrer → 3-2-1-GO → cap chrome → stations → TIME leftover → `27+3` glosé. Pause : cap continue. Mixed day : squat n’a pas mangé le cap.
3. **Kill-app** — à ~T+12:00 d’un 20 min, remaining ≈ 8:00, pas de 2ᵉ GO.
4. **History** — sheet PB rounds ; changer cap 20→10 = nouveau PB.
5. **Never-naked** — spot-check Builder, card, runner, sheet, MCP `rendered`.
6. **MCP** — FR: *« crée-moi Cindy AMRAP 20 min »* → dry_run `AMRAP 20 min · 5/10/15` → apply → details echo. History après une vraie run : `27+3` glosé.
7. **Generator garde-fou** — QW/preview « HIIT 20 min » reste Tours (sanity, fixtures T189 déjà là).

## Out of Scope

- New features ; #398 ; T144 ; EMOM ; persister le CCT **Tours**.

## Acceptance Criteria

- [ ] Scénarios 1–7 documentés (pass / bugs).
- [ ] Blocking bugs filed or fixed before epic close.
- [ ] 0 surface HITL avec `AMRAP` ou `27+3` sans gloss.

## References

- Epic Brief : Success Criteria + measures stories 2, 9, 19, 21, 24–26
- #474
