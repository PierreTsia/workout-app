# Epic Brief — Circuit Completion Time (#396)

## Summary

Donner à l'utilisateur qui **refait un circuit** une lecture de **combien de temps il met à le boucler**, séance après séance. Le temps est **dérivé gratuitement** des `set_logs` existants (`MAX(logged_at) − MIN(logged_at)`, décision A1) — donc rétroactif sur tout l'historique, zéro migration, hors moteur de progression (cohérent ADR 0007). C'est une **stat, pas un juge** : on affiche le temps brut, et un delta (« −18s ») **uniquement entre deux runs de prescription identique**. Deux surfaces : le temps par run sur la **History card**, et un **Block history sheet** (tendance + delta + meilleur temps), ouvert par tap sur la carte, qui mirror l'`ExerciseHistorySheet` solo existant. Le modèle « benchmark figé, temps = vrai score » (type Freeletics Zeus) est explicitement déporté en **#398**.

---

## Context & Problem

**Who is affected:** Pratiquants qui entraînent au circuit (Freeletics, AMRAP, tours chronométrés) — l'insight post-#394 : *« la vraie progression sur des séances à circuits, c'est le temps passé à les valider »*.

**Current state:**
- Les circuits (**Exercise Block**) ont shippé en #351/#394 **sans moteur de progression** (ADR 0007) : structure riche, mais reps/poids ne progressent que sur les solos.
- Chaque cellule de circuit écrit un `set_logs` avec `logged_at` horodaté (`file:src/lib/blockSetLog.ts`), regroupé en historique par `groupSessionHistory` (`file:src/lib/sessionHistoryGrouping.ts`) et rendu par `BlockHistoryCard` (`file:src/components/history/BlockHistoryCard.tsx`).
- **Aucun temps de complétion** n'est ni calculé ni affiché ; un user circuit n'a aucune story de progression.

**Pain points:**
| Pain | Impact |
|---|---|
| Pas de temps de complétion | Le signal le plus parlant d'un circuit (la vitesse) est invisible |
| Pas de tendance inter-séances | Impossible de voir « je vais plus vite qu'il y a 3 semaines » |
| Pas de comparaison honnête | Sans garde-fou, comparer deux circuits de prescriptions différentes mentirait |

---

## User Stories

1. As a user who repeats a circuit, I want to see **how long each past run took**, so that I have a sense of my pace.
2. As a user reviewing history, I want a **per-run completion time on the `BlockHistoryCard`** (« Circuit bouclé en 4:32 »), so that it shows inline with the session.
3. As a user, I want to **tap the `BlockHistoryCard`** to open a **Block history sheet** listing my completion times for *this* circuit across sessions (with a trend chart, mirroring `ExerciseHistorySheet`), so that I see the trend at a glance.
4. As a user, I want a **delta (« −18s vs dernière »)** shown **only between runs of identical shape**, so that the comparison is honest.
5. As a user, I want a **best-time (PB) marker** on my fastest *complete* run of a circuit, so that getting faster feels rewarded.
6. As a user who **edited the circuit** (added a round, changed reps/weight), I want differing-shape runs marked « prescription modifiée » **with no misleading delta**, so that I'm not lied to.
7. As a user who **abandoned a circuit mid-way** (or `discardBlock`), I want that partial run **excluded from the trend and PB**, so that a quit doesn't fake a record.
8. As a user, I want completion time to **include my rests/pauses (wall-clock)**, so that it reflects real time on the floor (façon Freeletics), not an idealized active-time.
9. As a user with **circuits done before this feature shipped**, I want completion times **computed retroactively** from my existing logs, so that I see history from day one.
10. As a user who did a circuit **only once**, I want the sheet to show the single time **cleanly** (no delta, no PB noise), so that a first run isn't confusing.
11. As a user, I want the completion time to **only appear once a run is complete** (`count == rounds × exercices`), so that a half-finished circuit never shows a bogus time.

### Success measures
| Story # | Measure |
|---|---|
| 9 | Tous les runs de circuit **complets déjà en base** affichent un temps sans nouvelle écriture |
| 4, 6 | Delta affiché **0 fois** entre deux runs de shape différente (test sur fingerprint reconstruit des `set_logs`) |
| 1–3 | Refaire un circuit 2× fait apparaître 2 temps + 1 delta dans le sheet |

---

## Scope

**In scope (v1):**
- **Temps de complétion dérivé (A1)** : `MAX(logged_at) − MIN(logged_at)` sur les `set_logs` d'un bloc dans une session — pauses incluses, pas de schéma, rétroactif.
- **Fingerprint de shape** reconstruit depuis les `set_logs` (mêmes `block_exercise_id`, mêmes rounds, mêmes amount/weight par cellule) pour décider de la comparabilité.
- **Gating run complet** : un temps n'existe que si toutes les cellules attendues sont loggées (`count == rounds × exercices`).
- **History card** : temps par run sur `BlockHistoryCard`, tappable pour ouvrir le sheet.
- **Block history sheet** : liste + trend chart des temps de ce circuit, delta entre runs de shape identique, badge **meilleur temps (PB)** — mirror de `ExerciseHistorySheet`/`ExerciseHistoryTrendChart`, ouvert par tap sur la carte.

**Out of scope (v1):**
- **Vraie horloge / colonne dédiée (A2)** : départ exact, mais migration + perte du rétroactif — rejeté.
- **Splits par round** (« round 1: 0:48 ») — follow-up.
- **Hook pré-séance** (« dernière fois : 4:32 ») et **finish-screen badge** — follow-up.
- **Benchmark Circuit** (circuit nommé/réutilisable, temps = vrai score cross-séance) → **#398**.
- **MCP / IA**, achievements dédiés circuits.

---

## Success Criteria

- **Qualitatif :** un user qui a fait son circuit lundi puis le lundi suivant (même prescription) voit, en tapant la `BlockHistoryCard`, ses deux temps, le delta entre eux, et un badge PB sur le plus rapide — le tout calculé sans aucune nouvelle écriture en base.
- **Honnêteté :** dès qu'une prescription change entre deux runs, le delta disparaît et un marqueur « modifié » apparaît ; un run incomplet n'apparaît jamais dans la tendance ni le PB.
- **Rétroactif :** les circuits déjà en base affichent un temps immédiatement, sans backfill.
- **Non-régression :** `BlockHistoryCard` et `groupSessionHistory` continuent de rendre les circuits existants à l'identique, plus la ligne de temps.

---

## References

- Issue : [#396](https://github.com/PierreTsia/workout-app/issues/396) ; spin-off : [#398](https://github.com/PierreTsia/workout-app/issues/398)
- ADR : `file:docs/adr/0007-exercise-blocks-rich-structure-no-progression.md`
- Glossaire (**Circuit Completion Time**, **Benchmark Circuit**) : `file:docs/CONTEXT.md`
- Données/UI existantes : `file:src/lib/blockSetLog.ts`, `file:src/lib/sessionHistoryGrouping.ts`, `file:src/components/history/BlockHistoryCard.tsx`
- Pattern à mirror : `file:src/components/workout/ExerciseHistorySheet.tsx`, `file:src/components/workout/ExerciseHistoryTrendChart.tsx`, `file:src/hooks/useExerciseHistory.ts`
