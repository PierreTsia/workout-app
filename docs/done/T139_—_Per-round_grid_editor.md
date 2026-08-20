# T139 — Per-round grid editor

## Goal

Donner au bloc sa souplesse cible : éditer une **Per-round Prescription** (reps/durée **et** poids par round) dans une grille exos×rounds, plus régler `rounds`, `rest_seconds` (entre rounds) et `transition_seconds` (entre exos). Couvre les stories 3, 4, 5, 6 (rounds, grille pyramidale, default « fill round 1 → propagate », rest/transition).

## Mode

**HITL** — la grille exos×rounds sur mobile (jusqu'à 9 cellules pour 3×3) est du vrai design d'interaction à valider avec l'artefact en main (densité, propagation, édition cellule par cellule).

## Slice

`useBlockMutations.updatePerRound / updateBlockMeta` → `BlockEditor` → `PerRoundGrid` → vitest

## Dependencies

T138.

## Scope

### Hooks — `useBlockMutations`

- `updateBlockMeta({ blockId, rounds?, rest_seconds?, transition_seconds?, label? })` : UPDATE `exercise_blocks`. Si `rounds` change, redimensionne `per_round` de chaque `block_exercise` (étend avec la dernière valeur, tronque par la fin).
- `updatePerRound({ blockExerciseId, perRound })` : UPDATE `block_exercises.per_round`.

### UI — `BlockEditor` + `PerRoundGrid`

- `BlockEditor.tsx` : ouvert depuis `BlockCard`. Champs bloc (rounds, rest, transition, label optionnel) + `PerRoundGrid`.
- `PerRoundGrid.tsx` : lignes = exos, colonnes = rounds. Cellule = `{ amount, weight }` (amount = reps ou durée selon `measurement_type` résolu via `useExerciseFromLibrary`). Default UX : remplir round 1 puis action « propager à tous les rounds » ; l'utilisateur édite ensuite les cellules divergentes (pyramide 20/15/10).
- Invariant `per_round.length === rounds` garanti app-side au save.

## Out of Scope

- Group/ungroup + reorder → **T140**.
- Exécution en séance → T141/T142.

## Acceptance Criteria

- [ ] Régler `rounds` redimensionne `per_round` de tous les exos du bloc sans perte des rounds existants.
- [ ] La grille édite reps/durée + poids indépendamment par (exo × round) ; une pyramide 20/15/10 persiste et se relit fidèlement.
- [ ] « Propager round 1 » remplit toutes les colonnes en une action.
- [ ] `rest_seconds` et `transition_seconds` sont éditables au niveau bloc et persistent.
- [ ] Un exo durée affiche/édite des secondes ; un exo reps des répétitions, dans la même grille.
- [ ] Tests vitest : redimensionnement `per_round`, propagation, save/relecture d'une pyramide.

## References

- Epic Brief : stories 3, 4, 5, 6
- Tech Plan : § Data Model (`per_round` JSONB), § Component Architecture (`PerRoundGrid`, `BlockEditor`)
