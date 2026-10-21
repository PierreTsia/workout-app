# T309 — L'échelle de charges, et `WEIGHT_UP` sur le palier suivant

## Goal

Le moteur prescrit une charge qui existe en salle. Aujourd'hui `WEIGHT_UP` avance d'un pas constant
(`currentWeight + weightIncrement`, `file:src/lib/progression.ts:463`) et peut donc demander 21 kg sur des
haltères qui passent de 2 en 2 puis de 5 en 5. Ce ticket livre le module pur d'**échelle de charges**
(échelles par défaut par catégorie d'équipement, dimension d'unité, résolution) et le branchement qui fait
que la charge prescrite est le **cran suivant de l'échelle**. Stories 1, 5, 7, 11, 14 — et pose la
résolution dont les stories 8, 9, 10 dépendent.

- **Mode :** AFK — aucune décision humaine en cours de route ; les échelles et l'unité sont tranchées dans
  le Tech Plan.
- **Slice :** `src/lib/loadLadder.ts` (nouveau, pur) → `buildPrescription` → `Prescription.loadLadder` →
  `computeNextSessionTarget` (branche `WEIGHT_UP`) → les deux hooks (`unit`) → vitest.

## Dependencies

Aucune. Premier ticket du chantier.

## Scope

### Le module `file:src/lib/loadLadder.ts` (nouveau)

Un module **pur** : pas de React, pas de Supabase, pas d'accès réseau. Même forme que
`file:src/lib/rirSuggestion.ts` pour l'incrément intra-séance.

| Élément | Détail |
|---|---|
| `LadderCategory` | `"dumbbell" \| "barbell" \| "stack"` |
| `LOAD_LADDER_CATEGORY` | `Record<string, LadderCategory \| null>` sur `EQUIPMENT_TAXONOMY` (`file:src/lib/catalogTaxonomy.ts:9`) : `dumbbell` + `kettlebell` → `dumbbell` ; `barbell` + `ez_bar` → `barbell` ; `machine` + `cable` → `stack` ; `bench`, `bodyweight`, `band`, `other` → `null` |
| `DEFAULT_LOAD_LADDERS` | Les littéraux **par unité** du Tech Plan, exportés tels quels pour la lisibilité et les tests |
| `LOAD_LADDERS_KG` | Les mêmes, **convertis en kg** une fois au chargement du module — c'est cette table que lit la résolution |
| `LADDER_MATCH_TOLERANCE_KG` | `0.1` |
| `resolveLoadLadder(equipment, unit)` | `number[] \| null` — l'échelle de la catégorie, **en kg** ; `null` si la catégorie n'en a pas |
| `nextLoad(ladder, currentKg)` | Le premier cran **strictement supérieur** à `currentKg + LADDER_MATCH_TOLERANCE_KG`, ou `null` |

L'unité vient de `WeightUnit` (`file:src/lib/rirSuggestion.ts:7`) — on **réutilise le type existant**, on
n'en crée pas un second.

### Le branchement dans `file:src/lib/progression.ts`

- `Prescription` gagne `loadLadder: number[] | null`.
- `BuildPrescriptionOptions` (`:155`) gagne `weightUnit?: WeightUnit`, **défaut `"kg"`** — les appelants
  non mis à jour et tous les tests existants gardent leur comportement.
- `buildPrescription` (`:186`) résout l'échelle **une seule fois** : `volume.type === "reps"` et catégorie
  d'échelle existante → `resolveLoadLadder(equipment, weightUnit)` ; sinon `null` (durée incluse).
- Branche `WEIGHT_UP` (`:462`) :

```ts
if (!maxWeightReached) {
  const ladderNext = loadLadder ? nextLoad(loadLadder, currentWeight) : null
  if (ladderNext != null) {
    return makeSuggestion("WEIGHT_UP", volume.min, ladderNext, currentSets,
      "progression.weightUp", String(round1(ladderNext - currentWeight)))
  }
  return makeSuggestion("WEIGHT_UP", volume.min, currentWeight + weightIncrement, currentSets,
    "progression.weightUp", String(weightIncrement))
}
```

Le refus du saut (T310) et le cran de descente de la Décharge (T311) ne sont **pas** dans ce ticket :
la branche `WEIGHT_UP` est le seul consommateur de l'échelle ici.

### Les deux hooks

`file:src/hooks/useProgressionSuggestion.ts:48` et
`file:src/hooks/useProgressionSuggestionsForDay.ts:108` passent `weightUnit: unit` (via
`useWeightUnit`, `file:src/hooks/useWeightUnit.ts:9`) dans les options de `buildPrescription`. Rien
d'autre ne change dans ces fichiers.

### Tests

- **`file:src/lib/loadLadder.test.ts`** (nouveau) : chaque table par défaut est strictement croissante ;
  le mapping couvre **tous** les slugs de `EQUIPMENT_TAXONOMY` ; `nextLoad` est strict (un cran égal ne
  compte pas) et absorbe la tolérance ; `null` au-dessus du dernier cran ; `null` sans échelle ;
  **l'invariant de cohérence** intra/inter : le premier pas de l'échelle kg haltères = 2 kg, kg barre =
  2,5 kg, lbs haltères/barre = 5 lb — les valeurs de `DEFAULT_INCREMENT` / `DUMBBELL_INCREMENT`
  (`file:src/lib/rirSuggestion.ts:42-43`).
- **`file:src/lib/progression.test.ts`** (complété) : un slot haltères à 20 kg, toutes séries au plafond
  de reps, RIR > 1, `max_weight_reached` false → `WEIGHT_UP` à **25 kg** avec reps remises à
  `volume.min` ; un slot sans échelle garde `currentWeight + 2.5` ; un exercice en durée ne résout aucune
  échelle.

## Out of Scope

- Le **refus du saut** et l'escalade vers `SETS_UP` → **T310**.
- Le **cran de descente de la Décharge** → **T311**.
- L'**override par exercice** (une échelle par exercice) — hors v1, cf. Epic Brief.
- L'UI de déclaration des échelles, le choix de formule `EPLEY` / `BRZYCKI`.
- Le bug #713 (`WEIGHT_UP` sur un exercice en durée) : ce ticket **n'y touche pas**, il l'exclut
  explicitement.

## Acceptance Criteria

- [ ] `resolveLoadLadder("dumbbell", "kg")` rend l'échelle kg haltères du Tech Plan ; `resolveLoadLadder("bodyweight", "kg")` rend `null`.
- [ ] Toute table par défaut est strictement croissante (test paramétré sur les 6 échelles).
- [ ] `nextLoad` rend le premier cran **strictement** supérieur à 0,1 kg près, et `null` au-dessus du dernier cran.
- [ ] Démo de bout en bout : un slot haltères à 20 kg × 12, toutes séries au plafond, RIR > 1 → la suggestion est `WEIGHT_UP` à **25 kg** (et non 22,5 kg), reps remises au minimum de la plage.
- [ ] Un slot sans échelle (poids du corps, bande) garde l'incrément hérité : `currentWeight + 2.5`.
- [ ] Un exercice **en durée** ne résout aucune échelle : le comportement d'aujourd'hui est inchangé.
- [ ] Un athlète en **lbs** à 45 lb reçoit `WEIGHT_UP` à 50 lb (cran exact), pas 45 + 5,5.
- [ ] L'invariant de cohérence intra/inter est testé et vert (2 / 2,5 / 5).
- [ ] `npm test` vert, `npm run lint` vert.

## References

- Epic Brief : `file:docs/Epic_Brief_—_Charge_réelle_en_salle_(échelle_de_charges)_#705.md`
- Tech Plan : `file:docs/Tech_Plan_—_Charge_réelle_en_salle_(échelle_de_charges)_#705.md` — *Data Model*, *Component Architecture*, *Failure Mode Analysis*
- ADR `file:docs/adr/0034-load-ladder-constrains-prescribed-load.md`
- Glossaire : **Load Ladder**, **Load Jump**, **Progression Rule** (`file:docs/CONTEXT.md`)
- Epic [#705](https://github.com/PierreTsia/workout-app/issues/705)
