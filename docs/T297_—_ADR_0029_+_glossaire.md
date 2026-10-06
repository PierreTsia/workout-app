# T297 — ADR 0029 + glossaire Session time

## Goal

Documenter la décision : la garde de 15 min de temps caché remplace l'auto-pause
immédiate de #655, et le glossaire **Session time** reflète qu'un passage en
arrière-plan ≤ 15 min compte désormais.

## Dependencies

T295, T296.

## Scope

### `docs/adr/0029-inactivity-guard-15min.md`

- Format `docs/adr/README.md` : Status, Date, Decided in, Context, Decision,
  Consequences, Alternatives considered.
- Statut : Accepted. Supersède la partie « pause immédiate » de #655.
- Ajouter la ligne d'index dans `docs/adr/README.md`.

### `docs/CONTEXT.md`

- Mettre à jour l'entrée **Session time** : un passage en arrière-plan ≤ 15 min
  compte ; > 15 min est exclu.

## Out of Scope

- Toute modification de code.

## Acceptance Criteria

- [ ] `docs/adr/0029-inactivity-guard-15min.md` suit le format du README ADR.
- [ ] L'index `docs/adr/README.md` référence 0029.
- [ ] L'entrée **Session time** de `docs/CONTEXT.md` dit que ≤ 15 min compte.
- [ ] `npm test`, `npx tsc -b`, `npm run lint` verts (docs seules).

## References

- Epic Brief `file:docs/Epic_Brief_—_Timers_en_arrière-plan_#664.md`
- Tech Plan `file:docs/Tech_Plan_—_Timers_en_arrière-plan_#664.md`
- `file:docs/adr/README.md`
