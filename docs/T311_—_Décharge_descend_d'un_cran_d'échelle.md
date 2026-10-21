# T311 — La Décharge descend d'un cran d'échelle

## Goal

La **Décharge** de P2 (ADR 0033) baisse la charge d'un pas pour sortir un **Exercise Slot** d'un
**Stall** — mais ce pas est aujourd'hui le même incrément constant de 2,5 kg
(`file:src/lib/progression.ts:386`), ce qui peut prescrire une charge inexistante (25 kg → 23 kg sur des
haltères qui n'ont pas de 23). Ce ticket fait descendre la Décharge d'un **cran d'échelle** : le pas de
récupération est lui aussi une charge que l'athlète peut composer. Story 12.

- **Mode :** AFK — la règle de descente est tranchée dans le Tech Plan (cran précédent, repli hérité).
- **Slice :** `src/lib/loadLadder.ts` (`previousLoad`) → `src/lib/progression.ts` (branche `DELOAD`)
  → vitest.

## Dependencies

- **T309** — l'échelle résolue dans la `Prescription`. Indépendant de T310 (chemins de code distincts).

## Scope

### `file:src/lib/loadLadder.ts` (complété)

- `previousLoad(ladder, currentKg): number | null` → le dernier cran **strictement inférieur** à
  `currentKg - LADDER_MATCH_TOLERANCE_KG`, ou `null` au premier cran / sans échelle.

### `file:src/lib/progression.ts` — branche `DELOAD` (`:386`)

Un **repli en une ligne**, pas une nouvelle branche :

```ts
const deloadWeight =
  previousLoad(loadLadder, currentWeight) ??
  Math.max(weightIncrement, currentWeight - weightIncrement)
```

Le `Math.max(...)` existant reste — c'est le **plancher** qui garantit qu'une Décharge baisse toujours de
quelque chose. La branche *reps-only* (`reps × PROPORTIONAL_DELOAD_FACTOR`) n'est **pas touchée** : elle
ne passe pas par l'axe charge.

Le seuil de saut (`LOAD_JUMP_MAX_RATIO`, T310) **ne s'applique pas ici** : une décharge est une vraie
baisse, pas un micro-pas. Descendre de 10 → 5 kg sur une pile (−50 %) est le comportement voulu.

Aucune clé i18n nouvelle : le libellé de la Décharge (`progression.deload`, `progression.deloadDetail`)
est inchangé. La pastille affiche toujours la charge nouvellement prescrite.

### Tests — `file:src/lib/progression.test.ts`

| Cas | Attendu |
|---|---|
| Slot haltères à 25 kg en `Stall` (4 séances, RIR ≤ 1) | `DELOAD` à **20 kg** (cran précédent), pas 23 kg |
| Slot au **premier cran** de son échelle | repli sur `Math.max(weightIncrement, currentWeight - weightIncrement)` |
| Slot **sans échelle** (poids du corps, bande) | comportement actuel strictement inchangé |
| Équipement *reps-only* | `reps × 0,85` inchangé, aucun passage par l'échelle |
| Charge courante **hors échelle** (23 kg saisi à la main) | `previousLoad` rend le cran inférieur (20 kg) |

Le dernier cas est volontaire : une charge orpheline doit redescendre sur **une** échelle, pas rester
orpheline.

## Out of Scope

- Le **refus du saut à la montée** → **T310**.
- Le **déclencheur** de la Décharge : le **Stall** et `STALL_SESSIONS = 4` restent tels quels (ADR 0033).
  Ce ticket ne touche que le **montant** du pas de descente.
- Un seuil de baisse maximal — une décharge peut descendre plus que `LOAD_JUMP_MAX_RATIO`, c'est voulu.
- L'override par exercice, l'UI de déclaration, le choix de formule.

## Acceptance Criteria

- [ ] Démo de bout en bout : un slot haltères à 25 kg stagnant 4 séances au dernier RIR ≤ 1 reçoit un `DELOAD` à **20 kg** — une charge qui existe.
- [ ] Au premier cran de l'échelle, la Décharge retombe sur `Math.max(weightIncrement, currentWeight - weightIncrement)` (jamais 0, jamais négatif).
- [ ] Un slot sans échelle garde exactement le comportement d'aujourd'hui (test de non-régression).
- [ ] Un équipement *reps-only* applique toujours `reps × 0,85` et ne lit pas l'échelle.
- [ ] Une charge courante hors échelle redescend sur le cran inférieur.
- [ ] Le déclencheur de **Stall** (4 séances, RIR ≤ 1, cible servie égale) n'est pas modifié : une Décharge sert toujours **une seule** séance.
- [ ] `npm test` vert, `npm run lint` vert.

## References

- Epic Brief : `file:docs/Epic_Brief_—_Charge_réelle_en_salle_(échelle_de_charges)_#705.md`
- Tech Plan : `file:docs/Tech_Plan_—_Charge_réelle_en_salle_(échelle_de_charges)_#705.md` — *Critical Constraints*, *Failure Mode Analysis*, Stress-Test item 5
- ADR `file:docs/adr/0034-load-ladder-constrains-prescribed-load.md`
- ADR `file:docs/adr/0033-plateau-exit-triggered-by-prescription-stall.md` — le **Stall** et la Décharge, non modifiés ici
- Glossaire : **Deload**, **Load Ladder**, **Stall** (`file:docs/CONTEXT.md`)
- Epic [#705](https://github.com/PierreTsia/workout-app/issues/705)
