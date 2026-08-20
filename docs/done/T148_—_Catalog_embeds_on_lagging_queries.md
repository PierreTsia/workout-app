# T148 — Catalog embeds on lagging queries

## Goal

Quatre requêtes portent `exercise_id` mais **pas** la ligne `exercises` : elles ne peuvent donc rien localiser. Ce ticket leur ajoute l'embed catalogue, sans changer aucun rendu — un ticket d'infrastructure de données, volontairement isolé pour que sa régression potentielle (payload, forme de cache, types) soit diagnosticable seule.

| Requête | Select actuel |
|---|---|
| `file:src/hooks/useSessionSetLogs.ts` | `select("*")` |
| `file:src/hooks/useExerciseHistory.ts` | `select("exercise_id, exercise_name_snapshot")` |
| `file:src/components/library/ProgramDetailSheet.tsx` | `select("*, workout_exercises(*)")` |
| `file:src/hooks/useSavedWorkouts.ts` | `select("*, workout_exercises(id, name_snapshot, …, muscle_snapshot)")` |

## Mode

**AFK**.

## Slice

4 requêtes → types → tests de forme

## Dependencies

Aucune (parallélisable avec T145-T147).

## Scope

### Embeds

- Ajouter `exercise:exercises(<projection>)` aux quatre requêtes.
- **Projection minimale**, pas `*` : `id, name, name_en, muscle_group, equipment, emoji` suffit à tout ce que l'epic affiche. Le commentaire de `file:src/lib/exerciseSelects.ts` (24-35) est explicite — chaque colonne embarquée est payée sur *chaque* ligne. Si la projection est réutilisée telle quelle par les quatre, l'ajouter à `exerciseSelects.ts` sous un nom parlant plutôt que la dupliquer.
- `useSavedWorkouts` : l'embed va dans la projection **imbriquée** `workout_exercises(...)`, pas au niveau `workout_days`.

### Types

- Étendre les types de retour (`SetLog & { exercise: … | null }`, `DayWithExercises`, `SavedWorkout`) — l'embed est **nullable** : ligne catalogue supprimée, ou exercice custom.

### Non-régression

- Aucun composant ne change de rendu dans ce ticket. Les tests existants doivent passer inchangés.
- Vérifier que la taille de payload de `useSavedWorkouts` et `ProgramDetailSheet` reste raisonnable : ce sont des listes potentiellement longues, c'est le seul endroit où l'embed a un coût réel.

## Out of Scope

- Utiliser la donnée nouvellement disponible (T149, T150, T151).
- Le `ORDER BY` de `useSessionSetLogs` (T150 — il est indissociable du regroupement).

## Acceptance Criteria

- [ ] Les 4 requêtes retournent la ligne catalogue jointe.
- [ ] La projection est énumérée, jamais `*`.
- [ ] Les types reflètent la nullabilité de l'embed.
- [ ] Aucun changement visuel, aucun test existant modifié.

## References

- Epic Brief : stories 5 (rétroactivité sans réécriture), 9 (zéro requête supplémentaire en séance)
- Tech Plan : § Critical Constraints (quatre requêtes), § Modified Files
- `file:src/lib/exerciseSelects.ts`
