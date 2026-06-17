# ADR 0008 — Circuit completion time: derived, not scored (v1)

- **Status:** Accepted
- **Date:** 2026-06-17
- **Decided in:** grilling session (`grill-with-docs`) + Epic Brief / Tech Plan for issue #396

## Context

Les circuits (**Exercise Block**) ont shippé en #351/#394 **sans moteur de progression** (ADR 0007) : structure riche, mais reps/poids ne progressent que sur les solos. L'insight post-#394 : sur une séance à circuits, le signal le plus parlant n'est pas « +2.5 kg sur une station », c'est **le temps pour boucler le circuit**.

Deux tensions sont apparues pendant le grilling :

1. **Comment mesurer le temps ?** Chaque cellule de circuit écrit déjà un `set_logs` horodaté (`logged_at`, posé client-side dans `file:src/lib/blockSetLog.ts`). Un temps de complétion est donc **dérivable** sans rien persister — au prix d'un départ légèrement faux (le premier log arrive après la 1re cellule). L'alternative est une **vraie horloge** : stamp de départ dans `blockRunner` + colonne dédiée.
2. **Le temps est-il un score de progression ?** Comparer le temps de deux runs n'a de sens qu'à **prescription identique**. Dès que la shape change (rounds, reps, poids), comparer ment. Et un circuit *nommé, figé, réutilisable* (type Freeletics « Zeus ») — où le temps EST le score — est un objet produit différent de l'`exercise_block` instance-bound d'aujourd'hui.

## Decision

Nous dérivons le temps de complétion, **sans persistance ni jugement**, et nous déportons le « temps = vrai score » dans un epic séparé.

- **A1 — Dérivé, pas d'horloge (v1).** `completionSeconds = MAX(logged_at) − MIN(logged_at)` sur les `set_logs` d'un bloc dans une session. Zéro migration, **rétroactif** sur tout l'historique. Pauses **incluses** (wall-clock, façon Freeletics ; jamais ajusté comme `accumulatedPause` du rest timer). Le biais de départ est constant donc les deltas inter-runs restent justes.
- **Stat, pas score.** Le temps s'affiche brut. Un **delta** (« −18s ») n'apparaît qu'entre deux runs **de fingerprint identique** (exos × rounds × reps/durée × **poids** par cellule). Un **PB** est calculé **par groupe de fingerprint**. Les runs incomplets (grille à trou) sont exclus. Aucune célébration auto-jugée, aucun achievement.
- **Le vrai « time-as-score » vit ailleurs.** Le modèle benchmark figé/réutilisable est `#398` (**Benchmark Circuit**), à griller séparément. #396 ne le préfigure pas.

## Consequences

- **Positive :**
  - Coût v1 borné à de la lecture + une lib pure + un sheet : ni schéma, ni écriture, ni moteur de progression touché (cohérent ADR 0006/0007).
  - L'utilisateur voit des temps **dès le jour 1** sur ses circuits déjà en base, sans backfill.
  - La comparaison reste **honnête** : pas de delta mensonger quand la prescription change.

- **Negative :**
  - Le temps est **systématiquement sous-estimé** d'un petit offset (départ = fin de la 1re cellule). Acceptable pour une stat non-jugée ; faux pour un classement précis.
  - Dépend de l'horloge **client** (`logged_at`) — un device mal réglé fausse le run.
  - Deux notions de « circuit » vont coexister un temps : l'instance jetable (#351) et le futur benchmark réutilisable (#398). À tenir au clair via le glossaire.

- **Follow-ups :**
  - Surfaces différées hors v1 : splits par round, hook pré-séance (« dernière fois : 4:32 »), finish-screen badge.
  - **Escape hatch A2** : si on veut le vrai départ plus tard, ajouter `block_elapsed_seconds` (+ stamp `blockRunner`) et faire de `MAX−MIN` un *fallback* — la lib `blockCompletionHistory.ts` absorbe une source de plus sans réécriture.
  - Grilling de **#398** (Benchmark Circuit) avant tout Epic Brief.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **A2 — Vraie horloge (stamp runner + colonne)** | Départ exact, mais migration + changement de `blockRunner`/sync, et surtout **pas rétroactif** (zéro historique sur les circuits existants). Surdimensionné pour une stat. |
| **Temps comme score de progression auto-jugé** | Compare des prescriptions différentes → ment dès qu'on change rounds/reps/poids ou sur un circuit *timed*. Faux signal. |
| **Fusionner #396 et le benchmark réutilisable (#398)** | Conflle une stat cheap dérivée avec un gros epic catalogue (réutilisation, identité globale, PR cross-séance). Tue le scope du livrable rapide. |
| **Hash de shape strict comme identité de circuit** | Ajouter 1 round « détruirait » le circuit (historique reset). On ancre sur `block_id` (identité) et on ne coupe que le *delta* à la frontière de shape. |
