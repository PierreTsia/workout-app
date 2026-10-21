# T709 — Surface « Décharge » : pastille + i18n

## Goal

L'athlète voit **pourquoi** sa cible baisse : la pastille affiche « Décharge » avec une explication, au
lieu d'une réduction muette. Couvre la story 2 de l'Epic Brief. Les entrées mécaniques du pill
(icône/couleur/auto-appliquée) sont posées en T707 ; ce ticket ajoute les **chaînes** et le détail.

## Mode

AFK.

## Slice

`reasonKey` (`progression.deload`) dans `file:src/lib/progression.ts` → clés `src/locales/{en,fr}/workout.json`
→ détail `ProgressionPill` → fixtures de test.

## Dependencies

T707.

## Scope

### Chaînes (contract du Tech Plan)

- `src/locales/en/workout.json` et `src/locales/fr/workout.json` : les deux clés du contrat i18n,
  **valeurs exactes** (aucune réécriture) :

| Key | EN | FR |
|---|---|---|
| `progression.deload` | Deload | Décharge |
| `progression.deloadDetail` | Your target hasn't moved in a while and you're training close to failure. A lighter session to recover — just this once. | Ta cible ne bouge plus depuis un moment et tu t'entraînes proche de l'échec. Séance plus légère pour récupérer — juste cette fois. |

- Le `reasonKey` de la branche `DELOAD` vaut `progression.deload` (le pill compose `…Detail`).

### Pastille

- `file:src/components/workout/ProgressionPill.tsx` : le détail s'affiche au tap ; le mode compact
  expose le libellé via `aria-label`.

### Tests

- `src/components/workout/ProgressionPill.test.tsx` : fixture `DELOAD` (couleur neutre, pas de delta,
  détail visible).
- `src/locales/locales.test.ts` : parité EN/FR (déjà générique, doit rester vert).

## Out of Scope

- Toute modification de la règle, de la RPC ou du seam (T707/T708).
- Un gloss parentétique du mot « Deload » (pas de place en mode compact ; le popover contextualise).

## Acceptance Criteria

- [ ] `progression.deload` et `progression.deloadDetail` existent en EN et FR, avec les mêmes
      placeholders (aucun ici).
- [ ] La pastille in-session affiche « Décharge » et son détail au tap.
- [ ] Le mode compact expose « Décharge » via `aria-label`.
- [ ] `src/locales/locales.test.ts` et les tests du pill passent.
- [ ] `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm test` verts.

## References

- Epic Brief `docs/Epic_Brief_—_Sortie_de_blocage_(décharge_planifiée)_#705.md` (story 2)
- Tech Plan `docs/Tech_Plan_—_Sortie_de_blocage_(décharge_planifiée)_#705.md` (§i18n contract)
- T707