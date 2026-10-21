# T708 — Décharge en pré-session

## Goal

La liste du jour, **avant** de commencer la séance, reflète la **Décharge** : les suggestions
pré-séance d'un slot bloqué portent la même cible allégée que la séance en cours. Couvre la story 1 sur
la surface pré-séance de l'Epic Brief.

## Mode

AFK.

## Slice

`useProgressionSuggestionsForDay` (lecture batch via `useSlotPrescriptionHistory` + `equipment` à
`buildPrescription`) → `stallHistory` au moteur → `PreSessionExerciseList` (prefill + pill compact) →
vitest.

## Dependencies

T707.

## Scope

### Lecture batch

- `file:src/hooks/useProgressionSuggestionsForDay.ts` : un **seul** appel à `useSlotPrescriptionHistory`
  pour tous les slots du jour (`before = now()`), puis passer `stallHistory` à
  `computeNextSessionTarget`.

### `equipment` — l'incrément doit être le même qu'in-session

- Le hook appelle aujourd'hui `buildPrescription` **sans** `equipment` (`:101-104`) : l'incrément retombe
  sur `resolveWeightIncrement(null, undefined) = 2,5 kg` même pour un haltère, alors que le seam
  in-session passe l'`equipment` du catalogue et obtient 2,0 kg. Résultat : la décharge d'un haltère
  diffère entre la liste du jour et la séance.
- Charger l'`equipment` du catalogue pour les exercices du jour (réutiliser la ligne catalogue déjà
  chargée pour la liste pré-séance ; sinon `fetchExercisesByIds`) et le passer à `buildPrescription`.

### Surface

- La liste pré-séance (`PreSessionExerciseList` / `ExerciseEditRowControls`) reflète la décharge (mêmes
  valeurs que le seam in-session ; pastille compacte déjà branchée par T707).

### Tests

- `src/hooks/useProgressionSuggestionsForDay.test.ts` : un slot bloqué produit la décharge pré-séance ;
  un seul appel RPC pour N slots ; **une haltère sans `weight_increment` explicite donne le même
  incrément qu'in-session** ; RPC en erreur → suggestions normales.

## Out of Scope

- Toute modification de la règle, de la RPC ou de la pastille (T707).

## Acceptance Criteria

- [ ] Les suggestions pré-séance d'un slot bloqué portent la décharge, **numériquement identiques** à
      celles du seam in-session (même incrément, y compris haltère).
- [ ] Un seul appel RPC couvre tous les slots du jour.
- [ ] RPC en erreur/absente → suggestions pré-séance normales (dégradation sûre).
- [ ] `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm test` verts.

## References

- Epic Brief `docs/Epic_Brief_—_Sortie_de_blocage_(décharge_planifiée)_#705.md` (story 1)
- Tech Plan `docs/Tech_Plan_—_Sortie_de_blocage_(décharge_planifiée)_#705.md` (§Layer Overview, §Key Decisions, §Component Responsibilities)
- T707