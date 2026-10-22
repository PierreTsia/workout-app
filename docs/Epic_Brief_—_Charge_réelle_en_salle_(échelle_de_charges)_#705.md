# Epic Brief — Charge réelle en salle : l'échelle de charges (P4)

## Summary

Quand le moteur monte la charge, il avance d'un **pas constant** — 2,5 kg barre, 2,0 kg haltères — aveugle
à ce que la salle propose réellement. Avec des haltères qui passent de 2 en 2 jusqu'à 20 kg puis de 5 en
5, le saut au-delà de 20 kg vaut **+25 %** ; dans une salle pauvre (20 → 30 kg), **+50 %**. Le moteur
prescrit donc régulièrement une charge que l'athlète ne peut pas composer. Cet epic donne à chaque
catégorie d'équipement une **Load Ladder** (échelle de charges) — les charges réellement composables —
livrée par défaut pour que rien ne soit à déclarer ; le moteur ne prescrit plus que des charges de
l'échelle, et un **Load Jump** trop gros est refusé au profit d'une série supplémentaire. Aucune UI,
aucun écran, aucun état persisté : un modèle et une règle (ADR
`file:docs/adr/0034-load-ladder-constrains-prescribed-load.md`).

---

## Context & Problem

**Who is affected:** tout athlète qui s'entraîne avec des haltères, une machine, une poulie ou une barre
dans une salle réelle — donc presque tout le monde hors poids du corps. N'affecte pas les exercices en
durée (aucune charge), ni les athlètes qui ne sont jamais montés en charge.

**Current state:**
- `resolveWeightIncrement` (`file:src/lib/progression.ts:147`) renvoie un pas **constant** par catégorie
  (2,5 kg barre / 2,0 kg haltères), avec un override par exercice (`workout_exercises.weight_increment`,
  saisissable dans le Builder, `file:src/components/builder/ExerciseDetailForm.tsx:277`).
- `WEIGHT_UP` prescrit `currentWeight + weightIncrement` (`file:src/lib/progression.ts:462`) : le moteur
  ne sait pas si la charge visée existe.
- L'ordre réel (`file:src/lib/progression.ts:404-492`) est une escalade : reps jusqu'au plafond → charge
  → séries → `PLATEAU` terminal.
- `SETS_UP` est **gaté sur `maxWeightReached`**, un flag **manuel** que l'athlète coche sur le slot
  (`:283`, `:474`). Qui ne le coche pas ne reçoit jamais de série supplémentaire : il reçoit `WEIGHT_UP`
  indéfiniment.
- P2 a livré la sortie de blocage (**Stall** → **Deload**, ADR 0033) ; le **Deload** lit lui aussi
  `weightIncrement` (`file:src/lib/progression.ts:386`). P4 est l'entrée de la dernière marche de cette
  escalade.

**Pain points:**

| Pain | Impact |
|---|---|
| Le pas constant ignore l'échelle réelle | Le moteur prescrit une charge que l'athlète ne peut pas composer |
| Le saut au-delà de 20 kg (+25 %) | Prescription infaisable ; l'échec coûte 4 séances avant que le **Stall** de P2 ne se déclenche |
| Une salle pauvre (20 → 30 kg, +50 %) | L'athlète ne peut pas suivre, et le moteur insiste |
| `SETS_UP` derrière un flag manuel | La montée en séries — la seule soupape quand la charge ne peut pas monter — n'existe pas pour qui ne coche pas |

---

## User Stories

1. As an athlete whose dumbbells step 2 kg to 20 then 5 kg, I want the engine to prescribe a load that
   exists in my gym, so that I am never told to load 21 kg.
2. As an athlete in a poorly equipped gym, I want a +50 % jump refused in favour of one more set, so that
   I keep progressing instead of failing.
3. As an athlete at the rep ceiling, I want the extra set to arrive without flagging anything by hand, so
   that the progression keeps moving on its own.
4. As an athlete grinding at RIR ≤ 1 with no load left to climb, I want the **Deload** of P2 to take
   over, so that an equipment ceiling leads to a real recovery step rather than a dead end.
5. As an athlete on a barbell, I want a sensible default ladder, so that I get the fix without describing
   my gym.
6. As an athlete with unusual equipment, I want to override the ladder for a single exercise, so that my
   reality beats the default. *(Différé : hors v1, cf. Scope.)*
7. As an athlete, I want the prescribed load to never leave the ladder, so that I can always compose what
   is asked.
8. As an athlete on a duration exercise, I want my prescription untouched, so that the change stays
   scoped.
9. As an athlete on reps-only equipment, I want no ladder to interfere, so that the rule means the same
   thing on my exercises.
10. As an athlete with legacy history on an off-ladder load, I want the engine to still find a sane next
    step, so that nothing regresses or jumps wildly.
11. As a maintainer, I want the ladder to be the single source of the load step, so that
    `weight_increment` stops being a second master.
12. As a maintainer, I want the **Deload** to read the ladder on the way down, so that a recovery step is
    also a load I can compose.
13. As a maintainer, I want the escalation (reps → charge → séries → décharge) documented as one order, so
    that each rule has exactly one reason to fire.
14. As a maintainer, I want zero new persisted state and zero new UI, so that P4 ships as a model and a
    rule.

### Success measures

| Story # | Measure |
|---|---|
| 11 | `weight_increment` is reachable only as the no-ladder fallback — no third way to express a step |
| 14 | 0 new screen, 0 new i18n key, 0 new migration |
| 4 | A maxed-out slot reaches `DELOAD` only through the existing **Stall** trigger — no new exit path |

Les autres stories se valident qualitativement, couvertes par les tests unitaires de la règle.

---

## Scope

**In scope:**

1. Une **Load Ladder** par catégorie d'équipement (défauts livrés : haltères 2/2 puis 5/5 au-delà de 20 ;
   barre dérivée d'un jeu de disques standard ; machine et poulie au pas de la pile).
2. La résolution **défaut de catégorie → repli** sur l'incrément hérité quand aucune échelle n'existe.
   *(L'override par exercice sort de la v1 : une échelle est une liste, donc une colonne et un champ de
   saisie — voir le Tech Plan.)*
3. Une **dimension d'unité** : les échelles sont écrites par unité (kg / lbs) et canonisées en kg, parce
   qu'une salle lbs a des haltères de 45 lb, pas de 20,4 kg.
4. `WEIGHT_UP` prescrit le **palier suivant de l'échelle**.
5. Refus d'un **Load Jump** au-delà de `LOAD_JUMP_MAX_RATIO` (~30 %) → `SETS_UP` à la place. Le flag
   `maxWeightReached` **survit** : `SETS_UP` se déclenche si le flag est coché **ou** si le saut est
   refusé (aucune migration, aucune surface retirée).
6. `DELOAD` descend d'un **cran d'échelle** (repli sur l'incrément sans échelle).
7. L'escalade documentée dans `file:docs/CONTEXT.md` et ADR 0034.

**Out of scope:**

- **L'override par exercice** (une échelle par exercice) — suivi séparé : il demande une colonne et un
  champ de saisie, donc une migration et une surface que la v1 n'a pas.
- **L'UI de déclaration des échelles** (Account) — suivi séparé ; les défauts couvrent le cas courant.
- **L'inventaire de disques** (barre fidèle aux disques possédés) — rejeté par ADR 0034.
- **Le modèle par salle** — le domaine n'a aucune notion de lieu.
- **Le choix de formule `EPLEY` / `BRZYCKI`** — héritage de P3, suivi séparé.
- **Relever le plafond de reps** au-delà de la plage déclarée — c'est la *rep-range ladder* exclue en P5.
- L'axe **durée** : P4 n'y touche pas, et le bug pré-existant (`WEIGHT_UP` peut prescrire 2,5 kg sur une
  planche, `file:src/lib/progression.ts:462`) part dans sa propre issue.
- P5, P6, la périodisation par blocs (#149), le chemin state-driven de #564.

---

## Success Criteria

- **Numeric:** toute charge prescrite est un cran d'échelle **quand un cran existe** — les replis hors
  échelle (au-dessus du dernier cran, en dessous du premier, aucune échelle déclarée) sont assumés et
  testés comme tels, pas niés ; un saut > 30 % ne produit jamais `WEIGHT_UP` ; un slot stagnant à RIR ≤ 1
  atteint toujours `DELOAD` par le chemin de **Stall** existant ; 0 migration ; 0 clé i18n.
- **Qualitative:** un athlète haltères au-delà de 20 kg cesse de voir des charges impossibles ; un athlète
  en salle pauvre reçoit une série au lieu d'un saut raté ; le défaut corrige le cas courant **sans
  configuration** ; `prescribed_*` et l'observatoire de déviations gardent leur sémantique.
- **Process:** ADR 0034 acte le choix ; `LOAD_JUMP_MAX_RATIO` et les échelles par défaut partent comme
  **valeurs de départ documentées, pas validées** — à recalibrer quand l'observatoire aura de la matière
  (il est encore muet : `progression_rule_served` = 0 ligne au 21/10). **Tranché en Tech Plan :** l'échelle
  **barre** est un littéral documenté (un jeu de disques standard), et le repli hors échelle prend le
  premier cran au-dessus — sinon l'incrément hérité, jamais de blocage.
