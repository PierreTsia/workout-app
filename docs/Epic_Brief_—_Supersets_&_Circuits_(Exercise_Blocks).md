# Epic Brief — Supersets & Circuits (Exercise Blocks)

## Summary

Permettre à un utilisateur de regrouper plusieurs exercices en un **Exercise Block** entraîné round-by-round (superset, triset, circuit), avec rest entre rounds et **Transition** entre exercices d'un même round. Le modèle est riche dès la v1 : reps/durée **et** poids peuvent varier par round (pyramides type Freeletics : 20 → 15 → 10). Pour tenir le coût, les blocs sont volontairement **hors moteur de progression** en v1 (prescription figée, éditée à la main) — voir ADR 0007. Pour l'utilisateur, l'app passe d'« une liste plate d'exos indépendants » à une **Unified Day Sequence** où un item peut être un bloc structuré.

---

## Context & Problem

**Who is affected:** Pratiquants intermédiaires/avancés (PPL avancé, hypertrophie, HIIT, full-body courts) — la demande utilisateur à l'origine de #351.

**Current state:**
- Un `workout_day` est une **liste plate** de `workout_exercises` triée par `sort_order` ; chaque ligne porte sa propre prescription scalaire (`sets / reps / weight / rest_seconds`).
  → `file:supabase/migrations/20240101000003_create_workout_exercises.sql`
- La session active **un seul exercice à la fois** (`file:src/pages/WorkoutPage.tsx` → `file:src/components/workout/ExerciseStrip.tsx` → `file:src/components/workout/ExerciseDetail.tsx`), avec un rest timer mono-stream (`file:src/components/workout/SetsTable.tsx` / `file:src/hooks/useRestTimer.ts`).
- Aucune notion de groupe/bloc ; aucune façon d'exprimer « rest entre rounds » ni des reps/poids qui changent par round.

**Pain points:**
| Pain | Impact |
|---|---|
| Pas de supersets/circuits | Primitive d'entraînement standard absente ; users avancés contraints à des workarounds (exos séparés, rest mal placé) |
| Rest attaché à l'exercice | Impossible d'exprimer « rest seulement entre les tours », pas entre A→B→C |
| Prescription scalaire unique | Pyramides (reps/poids variables par round) inexprimables |
| Strip mono-exo | Aucun endroit naturel pour afficher des chiffres différents par round |

---

## User Stories

**Builder — construction du bloc**
1. As an advanced user, I want to select several exercises in a day and group them into an **Exercise Block**, so that I can train them as a superset/circuit.
2. As an advanced user, I want a block to live in the same ordered list as my solo exercises and reorder freely (**Unified Day Sequence**), so that I can put a heavy squat before a finisher circuit.
3. As an advanced user, I want to set the number of **Rounds** for a block, so that I control how many times I loop through it.
4. As an advanced user, I want to edit reps/duration **and** weight per (exercise × round) in a grid (**Per-round Prescription**), so that I can build pyramids (20/15/10) and charged pyramids.
5. As an advanced user, I want a smart default ("fill round 1, auto-propagate to all rounds"), so that I'm not forced to fill every cell by hand for a non-pyramidal circuit.
6. As an advanced user, I want to set a block-level rest (between rounds) and a **Transition** (between exercises within a round), so that the timing matches my training.
7. As an advanced user, I want to mix reps-based and duration-based exercises in one block (10 burpees + 30s plank), so that circuits feel natural.
8. As an advanced user, I want the same exercise to appear twice in a block, so that I can build complexes.
9. As an advanced user, I want to ungroup a block back into solo exercises (the **round-1 Per-round Prescription** becomes each exercise's solo prescription; later rounds are discarded), so that I can undo a grouping decision.
10. As an advanced user, I want to delete a block (and optionally an exercise within it), so that I can edit my day.

**Session — exécution round-by-round**
11. As a user training, I want a dedicated **Round Screen** that shows the current round's exercises with that round's numbers, so that I always know what to do now.
12. As a user training, I want a **Transition** timer to arm between exercises inside a round, so that I respect the in-round pacing.
13. As a user training, I want the rest timer to arm only after the last exercise of a round, so that rest lands between rounds, not inside them.
14. As a user training, I want each completed cell to be logged as `set_logs` actuals, so that my history reflects what I did.
15. As a user training, I want the next round to display its own **Per-round Prescription**, so that pyramids show 20 then 15 then 10.
16. As a user training, I want to adjust a block value mid-session via the existing `ExerciseEditScopeDialog` (session-only vs template), so that I can correct a number without corrupting my template by accident.
17. As a user training, I want to mark the block complete and move on to the next day item, so that the session flows.

**History & discoverability**
18. As a user reviewing history, I want a completed block to render as a light grouped card (label + rounds + per-round actuals), so that it's not flattened into disconnected solo exercises.
19. As an advanced user, I want blocks exposed directly in the builder (no hidden "advanced mode"), so that I can discover the feature.

**Edge / empty / offline**
20. As a user, I want a block with one exercise or one round to behave sensibly (degenerate case allowed, but the UI doesn't encourage it), so that nothing breaks.
21. As a user offline, I want block creation/editing and in-session logging to follow the same offline behavior as today's flat exercises, so that the feature isn't a regression.
22. As a user, I want grouping/ungrouping to be blocked during an active session (builder-only), so that I don't corrupt a running workout. (Adjusting a *value* mid-session is still allowed — see story 16.)

### Success measures
| Story # | Measure |
|---|---|
| 11–17 | Un bloc 3 exos × 3 rounds pyramidal se logue entièrement sans bug d'affichage de chiffres ni de timer |
| 4 | Une pyramide chargée (poids croissant par round) est exprimable au builder et restituée fidèlement en session |
| Non-régression | Les séances 100 % solo se comportent à l'identique (builder, session, history, engine) |

---

## Scope

**In scope (v1):**
- Schéma **Exercise Block** riche : exos ordonnés, nb de **Rounds**, `rest_seconds` (entre rounds), `transition_seconds`, **Per-round Prescription** `{ amount, weight }` par cellule.
- **Unified Day Sequence** : solos + blocs mélangés et réordonnables (`sort_order` partagé).
- Builder : grouper/dégrouper (dégroupage = round 1), grille per-round, default "fill round 1 → auto-propagate", mix reps+durée, doublon d'exo, cas dégénéré toléré.
- Session : **Round Screen** dédié, **Transition** timer, rest inter-rounds, logging des actuals par cellule, édition de valeur via `ExerciseEditScopeDialog`.
- Historique : carte groupée légère.
- Blocs exposés franco dans le builder (pas de gate "advanced mode").

**Out of scope (v1):**
- **Progression** sur les blocs (frozen prescription — ADR 0007).
- **MCP** (`create_program` / `create_workout_day`) ne produit pas de blocs ; bump additif ultérieur (pattern legacy-detection déjà rodé).
- **IA** (Embedded Agent / Quick Workout) ne propose pas de blocs.
- **Grouping/ungrouping en pleine séance active.**
- **Rest variable par round** (scalaire → array, refinement non-breaking ultérieur).
- Achievements / stats dédiés circuits ; patterns adjacents (drop sets, EMOM, AMRAP, complexes haltère) — chacun son ticket.

---

## Success Criteria

- **Qualitatif :** un user avancé construit un circuit pyramidal (3 exos × 3 rounds, reps + poids variables, transition 20s, rest 90s) dans le builder, le réordonne au milieu de ses exos solos, l'exécute via le **Round Screen**, et le retrouve correctement en historique — sans toucher au moteur de progression.
- **Non-régression :** les séances 100 % solo (sans bloc) se comportent exactement comme avant (builder, session, history, engine).
- **Cohérence modèle :** zéro flat-list assumption cassée silencieusement — chaque endroit qui itère `workout_exercises` sait gérer un item-bloc.

---

## References

- Issue : [#351](https://github.com/PierreTsia/workout-app/issues/351)
- Décision d'architecture : `file:docs/adr/0007-exercise-blocks-rich-structure-no-progression.md`
- Glossaire (termes **Exercise Block**, **Round**, **Transition**, **Per-round Prescription**, **Unified Day Sequence**, **Round Screen**) : `file:docs/CONTEXT.md`
- Modèle de séance : `file:supabase/migrations/20240101000003_create_workout_exercises.sql`, `file:src/types/database.ts`
- Session UI : `file:src/pages/WorkoutPage.tsx`, `file:src/components/workout/SetsTable.tsx`, `file:src/hooks/useRestTimer.ts`
- Builder : `file:src/components/builder/DayEditor.tsx`, `file:src/components/builder/ExerciseRow.tsx`
