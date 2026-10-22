# T310 — Le saut trop gros est refusé → `SETS_UP`

## Goal

Quand le cran suivant de l'échelle est trop loin — une salle pauvre (20 → 30 kg, +50 %), un bas de pile
(5 → 10 kg, +100 %) — le moteur ne prescrit pas un saut que l'athlète va rater : il escalade d'une
**série** au poids courant. La répétition a déjà été épuisée (`WEIGHT_UP` ne se déclenche qu'au plafond de
reps) ; la série est la marche suivante, et elle existe déjà. Stories 2, 3, 13.

- **Mode :** AFK — le seuil (`LOAD_JUMP_MAX_RATIO = 0.30`) est tranché dans le Tech Plan.
- **Slice :** `src/lib/loadLadder.ts` (`loadJumpRatio`) → `src/lib/progression.ts` (branche `WEIGHT_UP`)
  → vitest.

## Dependencies

- **T309** — sans l'échelle résolue dans la `Prescription`, il n'y a rien à comparer.

## Scope

### `file:src/lib/loadLadder.ts` (complété)

- `LOAD_JUMP_MAX_RATIO = 0.30` — exporté, une seule constante, documentée comme valeur de départ
  (même statut que `STALL_SESSIONS`).
- `loadJumpRatio(fromKg, toKg): number` → `(toKg - fromKg) / fromKg` ; **`Infinity`** quand
  `fromKg <= 0` (un saut depuis zéro est toujours refusé, cf. `Failure Mode Analysis` du Tech Plan).

### `file:src/lib/progression.ts` — branche `WEIGHT_UP`

Le refus **retombe sur l'escalade existante** plutôt que d'en inventer une :

```ts
if (!maxWeightReached) {
  const ladderNext = loadLadder ? nextLoad(loadLadder, currentWeight) : null

  // Hors échelle, au-dessus du dernier cran, ou aucune échelle : pas de refus,
  // on retombe sur le pas hérité (jamais de blocage, jamais de saut inventé).
  if (ladderNext == null) {
    return makeSuggestion("WEIGHT_UP", volume.min, currentWeight + weightIncrement, currentSets,
      "progression.weightUp", String(weightIncrement))
  }

  if (loadJumpRatio(currentWeight, ladderNext) <= LOAD_JUMP_MAX_RATIO) {
    return makeSuggestion("WEIGHT_UP", volume.min, ladderNext, currentSets,
      "progression.weightUp", String(round1(ladderNext - currentWeight)))
  }
  // Saut refusé → on tombe sur SETS_UP ci-dessous, puis PLATEAU.
}

if (currentSets < setRangeMax) { /* SETS_UP — inchangé */ }
return /* PLATEAU — inchangé */
```

`maxWeightReached` **survit** : il n'est ni retiré ni migré. Le refus est une **condition de plus** sur le
même chemin — le flag coché et le saut refusé mènent tous deux à `SETS_UP`.

Aucune clé i18n nouvelle : `SETS_UP` garde `progression.setsUp` (`file:src/locales/{en,fr}/workout.json`).
Le refus est **silencieux** — l'athlète voit une série en plus, ce qui est une progression qui se
comprend seule.

### Tests — `file:src/lib/progression.test.ts`

Un test par branche, sur la même échelle kg haltères, pour qu'un réglage de `LOAD_JUMP_MAX_RATIO` qui
casserait l'acceptation normale se voie tout de suite :

| Cas | Attendu |
|---|---|
| 20 kg → cran suivant 25 kg (+25 %) | `WEIGHT_UP` à 25 kg — **accepté** |
| 20 kg sur une échelle pauvre dont le cran suivant est 30 kg (+50 %) | pas de `WEIGHT_UP` |
| Saut refusé, `currentSets < setRangeMax` | `SETS_UP`, poids inchangé |
| Saut refusé, séries au max | `PLATEAU` |
| `maxWeightReached: true` | comportement existant inchangé |
| Sans échelle (poids du corps) | `WEIGHT_UP` sur l'incrément hérité, aucun refus |
| `currentWeight <= 0` avec une échelle | refusé → `SETS_UP` / `PLATEAU` |

Le cas « échelle pauvre » se fabrique en **injectant une `Prescription`** dont `loadLadder` est une liste
courte — pas besoin de toucher aux tables par défaut.

## Out of Scope

- Le **cran de descente de la Décharge** → **T311**.
- L'**override par exercice**, l'UI de déclaration, le choix de formule.
- Un **seuil réglable par l'utilisateur** — hors v1.
- Un **message expliquant le refus** : le refus reste silencieux (0 clé i18n).
- Un plancher **absolu** en kilos en plus du ratio relatif : écarté au grill, à rouvrir si les bas de
  pile déçoivent en prod.

## Acceptance Criteria

- [ ] 20 kg → 30 kg (+50 %) ne produit **pas** `WEIGHT_UP`.
- [ ] 20 kg → 25 kg (+25 %) produit `WEIGHT_UP` à **25 kg** — la progression normale des haltères n'est pas cassée.
- [ ] Saut refusé avec `currentSets < setRangeMax` → `SETS_UP` (démo : le poids prescrit ne bouge pas, une série s'ajoute).
- [ ] Saut refusé avec les séries au max → `PLATEAU`, et le **Stall** d'ADR 0033 prend le relais sans modification.
- [ ] `maxWeightReached: true` : le comportement d'aujourd'hui est inchangé (test de non-régression).
- [ ] Sans échelle : repli sur l'incrément hérité, jamais de refus.
- [ ] `currentWeight <= 0` avec une échelle → `loadJumpRatio` rend `Infinity` → refusé.
- [ ] Aucune clé i18n ajoutée : `progression.setsUp` est réutilisée telle quelle (EN + FR).
- [ ] `npm test` vert, `npm run lint` vert.

## References

- Epic Brief : `file:docs/Epic_Brief_—_Charge_réelle_en_salle_(échelle_de_charges)_#705.md`
- Tech Plan : `file:docs/Tech_Plan_—_Charge_réelle_en_salle_(échelle_de_charges)_#705.md` — *La branche `WEIGHT_UP` réécrite*, *Failure Mode Analysis*, Stress-Test items 6 et 10
- ADR `file:docs/adr/0034-load-ladder-constrains-prescribed-load.md`
- Glossaire : **Load Jump**, **Load Ladder** (`file:docs/CONTEXT.md`)
- Epic [#705](https://github.com/PierreTsia/workout-app/issues/705)
