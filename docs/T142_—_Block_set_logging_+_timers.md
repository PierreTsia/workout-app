# T142 — Block set logging + timers

## Goal

Rendre le Round Screen pleinement fonctionnel : logger chaque cellule (exo × round) en `set_logs`, armer le timer de **Transition** entre exos et le rest **entre rounds**, persister offline, et **exclure les sets de bloc du moteur de progression** (sans les exclure des stats agrégées). Couvre les stories 12, 13, 14, 16.

## Mode

**AFK** — tout est figé au Tech Plan, y compris la stratégie `set_logs` (`block_exercise_id` + `log_slot`).

## Slice

`migration (block_exercise_id + log_slot + contrainte + RPC)` → `syncService` → `BlockRunner` cell log → `restAtom` rest/transition → vitest + playwright

## Dependencies

T141.

## Scope

### Migrations

- `{ts}_add_block_exercise_id_to_set_logs.sql` : `block_exercise_id uuid` (FK `ON DELETE SET NULL`) + `log_slot` générée `COALESCE(block_exercise_id, exercise_id)` STORED ; DROP `set_logs_session_exercise_set_uniq` ; CREATE UNIQUE `set_logs_session_slot_set_uniq (session_id, log_slot, set_number)`.
- `{ts}_exclude_block_logs_from_last_performance.sql` : `get_last_performance_for_exercises` += `WHERE block_exercise_id IS NULL`.

### `syncService`

- `SetLogPayload` += `blockExerciseId?: string`. `processSetLog` insère `block_exercise_id` (jamais `log_slot`). `onConflict` → `"session_id,log_slot,set_number"`. Fingerprint dédup queue → `realSessionId|{blockExerciseId ?? exerciseId}|set_number`.

### `useLastSessionDetail`

- Filtre `block_exercise_id IS NULL` (cohérent avec le RPC) pour ne pas polluer la suggestion de l'exo solo.

### `BlockRunner` (logging + timers)

- Compléter une cellule → `enqueueSetLog({ blockExerciseId, exerciseId, setNumber: roundIndex+1, prescribed* du round })` + `scheduleImmediateDrain`.
- `restAtom` armé avec `transition_seconds` entre exos d'un round, `rest_seconds` après le dernier exo du round (réutilise le mono-stream ; `kind` pour le libellé).
- Ne consomme jamais `useProgressionSuggestion` (`suggestion = null`).

### Édition de valeur en séance (story 16)

- Ajuster une valeur d'une cellule pendant la séance ouvre `ExerciseEditScopeDialog` (`file:src/components/workout/ExerciseEditScopeDialog.tsx`) : `session` → mute `blocksData` uniquement ; `permanent` → écrit aussi `block_exercises.per_round` (via `useBlockMutations.updatePerRound`).
- Grouper/dégrouper reste **bloqué** en séance (story 22) — seule l'édition de valeur est permise.

## Out of Scope

- Carte d'historique groupée → **T143**.
- Toute progression/suggestion sur les blocs (hors v1, ADR 0007).

## Acceptance Criteria

- [ ] Compléter une cellule écrit une ligne `set_logs` avec `block_exercise_id` non nul et `set_number` = round.
- [ ] Même `exercise_id` en solo + en bloc le même jour/session : aucune collision (`log_slot` distincts).
- [ ] Le timer de transition s'arme entre exos d'un round ; le rest s'arme après le dernier exo du round.
- [ ] Recharger en pleine séance restaure l'état du bloc (offline-first).
- [ ] Un exo fait en bloc n'altère **pas** la suggestion de progression de sa version solo (exclusion last-performance), mais **compte** dans le volume/sets.
- [ ] Ajuster une valeur en séance ouvre `ExerciseEditScopeDialog` ; `session` ne touche que `blocksData`, `permanent` écrit `per_round` ; grouper/dégrouper reste indisponible en séance.
- [ ] Tests vitest (`processSetLog` onConflict/log_slot, exclusion last-perf) + playwright (run pyramidal 3×3 end-to-end).

## References

- Epic Brief : stories 12, 13, 14, 16
- Tech Plan : § Data Model (set_logs), § Critical Constraints (onConflict/index partiels), § Failure Mode Analysis
