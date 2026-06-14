# T140 — Group / ungroup + reorder + block composition

## Goal

Permettre de transformer des exos solos en bloc et inversement, de gérer la composition d'un bloc (ajouter/retirer un exo, supprimer le bloc), et de réordonner librement solos et blocs dans le même jour (**Unified Day Sequence**). Couvre les stories 9 (dégroupage), 10 (suppression bloc/exo) et 2 (reorder mixte).

## Mode

**AFK** — décisions figées : dégroupage = la prescription du **round 1** devient la prescription solo de chaque exo, les rounds suivants sont jetés (ADR 0007 / Epic Brief story 9).

## Slice

`useBlockMutations.group / ungroup` + reorder DnD unifié → `DayEditor` affordances → vitest

## Dependencies

T138.

## Scope

### Hooks — `useBlockMutations`

- `group({ dayId, exerciseRowIds })` : crée un `exercise_blocks` à partir de ≥2 `workout_exercises` adjacents ; `per_round` round 1 = leur prescription courante (reps/poids), rounds 2..N propagés ; supprime les `workout_exercises` source ; le bloc prend le `sort_order` du premier.
- `ungroup({ blockId })` : recrée des `workout_exercises` (round 1 → `reps`/`weight`/`target_duration_seconds`), supprime le bloc ; réinsère aux `sort_order` adéquats.
- `reorderDayItems({ dayId, items })` : réassigne `sort_order` 0..n-1 sur les deux tables selon l'ordre final (best-effort, N updates parallèles comme l'existant).
- `addExerciseToBlock({ blockId, exerciseIds })` : insère des `block_exercises` (snapshots, `position` en fin, `per_round` dimensionné sur `rounds`).
- `removeExerciseFromBlock({ blockExerciseId })` : DELETE le `block_exercise` ; reséquence `position`.
- `deleteBlock({ blockId })` : DELETE le bloc (CASCADE sur `block_exercises`).

### UI — `DayEditor`

- DnD étendu aux `DayItem[]` (solos + blocs partagent le `SortableContext`).
- Affordance « Grouper avec le suivant » sur une ligne solo (ou sélection de 2 lignes adjacentes) → `group`.
- Affordance « Dégrouper » sur `BlockCard` → `ungroup`.
- Affordances « Supprimer le bloc » et « Retirer un exo » (+ ajout d'exo au bloc via picker).

## Out of Scope

- Édition per-round (assumée par T139).
- Group/ungroup **en séance active** — explicitement bloqué (Epic Brief story 22).

## Acceptance Criteria

- [ ] Grouper 2 solos adjacents crée un bloc dont le round 1 reprend leur prescription ; les solos disparaissent de la liste.
- [ ] Dégrouper un bloc recrée des solos avec la prescription du round 1 ; les rounds suivants sont jetés.
- [ ] Le DnD réordonne indifféremment solos et blocs ; l'ordre persiste après refetch.
- [ ] Une update de reorder en échec est récupérée par refetch (ordre serveur restauré).
- [ ] Supprimer un bloc le retire du jour (et ses `block_exercises` en cascade) ; retirer/ajouter un exo d'un bloc reséquence `position`.
- [ ] Tests vitest : `group` (per_round round1), `ungroup` (round1→solo), `reorderDayItems` (sort_order final), `deleteBlock`/`removeExerciseFromBlock`.

## References

- Epic Brief : stories 2, 9, 22
- Tech Plan : § Component Architecture (Builder grouping), § Critical Constraints (reorder non-transactionnel)
