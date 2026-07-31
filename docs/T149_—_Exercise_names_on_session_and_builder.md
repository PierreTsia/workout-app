# T149 — Exercise names on session & builder surfaces

## Goal

Câbler `useCatalogLabels().exerciseName` sur toutes les surfaces où la donnée catalogue est **déjà présente** — séance, builder, blocs, cartes de bibliothèque servies par `useWorkoutExercises`. C'est le gros du bénéfice utilisateur pour un coût quasi nul : `name_en` voyage déjà dans le payload, il suffit d'arrêter de lire `name_snapshot`.

## Mode

**AFK** — substitution mécanique une fois le helper livré.

## Slice

~20 composants → `exerciseName(row)` → tests FR/EN sur les surfaces principales

## Dependencies

T147.

## Scope

### Surfaces

- **Session** : `ExerciseDetail`, `ExerciseStrip`, `ExerciseEditRowControls`, `BlockRunner`, et les écrans de round.
- **Builder** : `ExerciseRow`, `ExerciseDetailForm`, `BlockCard`, `PerRoundGrid`, `DayEditor`.
- **Bibliothèque / cartes** servies par `useWorkoutExercises`.
- Remplacer `row.name_snapshot` par `exerciseName(row)`. **Ne pas supprimer la colonne ni cesser de l'écrire** — elle reste le filet de la chaîne de fallback.

### Ce qu'il ne faut pas casser

- `file:src/components/workout/ExerciseSwapInlinePanel.tsx` (45) filtre le picker sur `muscle_snapshot` : c'est de la **logique**, elle reste sur la valeur canonique. Seul l'affichage est traduit.
- Toute `key` React encore assise sur un nom doit passer sur `exercise_id` — une clé qui change avec la langue provoque un remount à la bascule.

### Tests

- Sur au moins trois surfaces représentatives (une session, une du builder, une de bloc) : même fixture, rendu en `fr` puis en `en`, deux libellés distincts attendus.
- Un test de non-régression FR par surface touchée (story 4).

## Out of Scope

- Les quatre requêtes sans embed (T148) et leurs surfaces (T150).
- Muscles et équipement (T151).

## Acceptance Criteria

- [ ] En `en`, une séance affiche les noms anglais quand `name_en` existe.
- [ ] En `fr`, l'affichage est identique à avant, partout.
- [ ] Un exercice sans `name_en` affiche `name` dans les deux locales.
- [ ] Aucune `key` React ne dépend d'un libellé localisé.
- [ ] Aucune requête réseau ajoutée.

## References

- Epic Brief : stories 1 (noms EN), 4 (non-régression FR), 5 (rétroactivité), 9 (offline), 10 (bascule en pleine séance)
- Tech Plan : § Architectural Approach, § Modified Files
