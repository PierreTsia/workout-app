# T138 — Block schema + create + read in builder

## Goal

Poser les fondations des **Exercise Blocks** et livrer le premier tracer bullet démoable : un utilisateur crée un bloc (plusieurs exos, rounds par défaut) depuis le builder et le voit comme une carte dans son jour, intercalé avec ses exos solos via un `sort_order` partagé. Couvre les stories 1, 2, 7, 8 de l'Epic Brief (grouper en bloc, **Unified Day Sequence**, mix reps+durée, doublon d'exo).

## Mode

**AFK** — décisions de schéma figées au Tech Plan + ADR 0007.

## Slice

`migration (exercise_blocks + block_exercises + RLS)` → `src/types/database.ts` → `useExerciseBlocks` + `useDayItems` → `useBlockMutations.create` → `BlockCard` + bouton « Créer un bloc » (picker existant) dans `DayEditor` → vitest

## Dependencies

None.

## Scope

### Migration — `supabase/migrations/{ts}_create_exercise_blocks.sql`

Tables `exercise_blocks` + `block_exercises` (voir Tech Plan § Data Model pour le DDL complet), index `idx_exercise_blocks_day`, `idx_block_exercises_block`, et RLS via la chaîne `workout_days.user_id` (politique directe pour `exercise_blocks`, via join pour `block_exercises`).

### Types — `src/types/database.ts`

| Type | Champs |
|---|---|
| `ExerciseBlock` | id, workout_day_id, label, rounds, rest_seconds, transition_seconds, sort_order, created_at |
| `BlockExercise` | id, block_id, exercise_id, name_snapshot, muscle_snapshot, emoji_snapshot, position, per_round |
| `PerRoundCell` | amount: number, weight: number |
| `DayItem` | union `{ kind: "solo", sort_order, exercise } \| { kind: "block", sort_order, block, exercises }` |

### Hooks

- `useExerciseBlocks(dayId)` : lit `exercise_blocks` + `block_exercises` (ordonnés `sort_order`, `position`).
- `useDayItems(dayId)` : merge `useWorkoutExercises` + `useExerciseBlocks` en `DayItem[]` trié par `sort_order`. **Devient la source unique** pour le builder.
- `useBlockMutations.create({ dayId, exerciseIds })` : insère `exercise_blocks` (`sort_order` = max+1 du jour, `rounds: 3` défaut) + `block_exercises` (snapshots, `position` = index, `per_round` = `rounds` cellules avec valeurs par défaut depuis le catalogue).

### UI — `BlockCard` + `DayEditor`

- `BlockCard.tsx` : carte affichant label/rounds, la liste des exos du bloc (nom + chiffre round 1), rest + transition. Lecture seule à ce stade.
- `DayEditor` : la liste utilise `useDayItems` ; rend `ExerciseRow` (solo) ou `BlockCard` (bloc). Bouton « Créer un bloc » → `ExerciseLibraryPicker` (multi-select existant) → `useBlockMutations.create`.

## Out of Scope

- Édition per-round / pyramide → **T139**.
- Group/ungroup de solos existants + reorder DnD unifié → **T140**.
- Toute exécution en séance → T141/T142.

## Acceptance Criteria

- [ ] Migration applique les 2 tables + index + RLS ; un user ne peut lire/écrire que ses propres blocs (vérifié RLS).
- [ ] `useDayItems` retourne solos et blocs mergés et triés par `sort_order`.
- [ ] Depuis `DayEditor`, créer un bloc à partir de ≥2 exos du picker insère `exercise_blocks` + `block_exercises` avec `per_round` de longueur `rounds`.
- [ ] Le bloc apparaît comme `BlockCard` dans la liste du jour, à la bonne position relative aux solos.
- [ ] Un même `exercise_id` peut figurer 2× dans un bloc (2 `block_exercises` distincts) — pas d'erreur.
- [ ] Un bloc peut mélanger un exo reps et un exo durée.
- [ ] Tests vitest : `useDayItems` merge/tri, `useBlockMutations.create` (shape `per_round`).

## References

- Epic Brief : `file:docs/Epic_Brief_—_Supersets_&_Circuits_(Exercise_Blocks).md` (stories 1, 2, 7, 8)
- Tech Plan : `file:docs/Tech_Plan_—_Supersets_&_Circuits_(Exercise_Blocks).md` (§ Data Model, § Component Architecture)
- ADR : `file:docs/adr/0007-exercise-blocks-rich-structure-no-progression.md`
