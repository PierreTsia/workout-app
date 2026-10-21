# T708 — Décharge en pré-session

## Goal

La liste du jour, **avant** de commencer la séance, reflète la **Décharge** : les suggestions
pré-séance d'un slot bloqué portent la même cible allégée que la séance en cours. Couvre la story 1 sur
la surface pré-séance de l'Epic Brief.

## Mode

AFK.

## Slice

`useProgressionSuggestionsForDay` (lecture batch via `useSlotPrescriptionHistory`) → passage
`stallHistory` + `equipment` au moteur → `PreSessionExerciseList` (prefill + pill compact) → vitest.

## Dependencies

T707.

## Scope

### Lecture batch

- `file:src/hooks/useProgressionSuggestionsForDay.ts` : un **seul** appel à `useSlotPrescriptionHistory`
  pour tous les slots du jour (`before = now()`), puis passer `stallHistory` et `equipment` à
  `computeNextSessionTarget`.

### Surface

- La liste pré-séance (`PreSessionExerciseList` / `ExerciseEditRowControls`) reflète la décharge
  (mêmes valeurs que le seam in-session ; pastille compacte déjà branchée par T707).

### Tests

- `src/hooks/useProgressionSuggestionsForDay.test.ts` : un slot bloqué produit la décharge pré-séance ;
  un seul appel RPC pour N slots ; RPC en erreur → suggestions normales.

## Out of Scope

- Toute modification de la règle ou de la RPC (T707).
- Les chaînes i18n (T709).

## Acceptance Criteria

- [ ] Les suggestions pré-séance d'un slot bloqué portent la décharge, identiques à celles du seam
      in-session.
- [ ] Un seul appel RPC couvre tous les slots du jour.
- [ ] RPC en erreur/absente → suggestions pré-séance normales (dégradation sûre).
- [ ] `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm test` verts.

## References

- Epic Brief `docs/Epic_Brief_—_Sortie_de_blocage_(décharge_planifiée)_#705.md` (story 1)
- Tech Plan `docs/Tech_Plan_—_Sortie_de_blocage_(décharge_planifiée)_#705.md` (§Layer Overview, §Component Responsibilities)
- T707