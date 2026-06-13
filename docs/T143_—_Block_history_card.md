# T143 — Block history card

## Goal

Afficher un bloc terminé dans l'historique comme une **carte groupée légère** (label + nombre de rounds + actuals par round), au lieu d'une suite d'exos solos déconnectés. Couvre la story 18.

## Mode

**AFK** — forme figée au brief (carte groupée, label + rounds + actuals).

## Slice

`history read (group by block_exercise_id)` → `BlockHistoryCard` → vitest

## Dependencies

T142.

## Scope

### Read

- La requête d'historique de session inclut `block_exercise_id` sur les `set_logs` et regroupe les sets par bloc → structure `{ block, rounds: RoundActuals[] }`.

### UI — `BlockHistoryCard`

- Carte affichant le label du bloc, le nombre de rounds, et pour chaque round les actuals par exo (amount + poids). Visuel distinct d'un exo solo.
- Les `set_logs` orphelins (`block_exercise_id` nullé après suppression du bloc) retombent proprement en affichage solo (snapshots conservés).

## Out of Scope

- Stats/achievements dédiés circuits (hors v1).
- Édition depuis l'historique.

## Acceptance Criteria

- [ ] Une session contenant un bloc affiche une `BlockHistoryCard` groupée (pas N lignes solos).
- [ ] La carte montre les actuals par round (pyramide visible en historique).
- [ ] Un `set_log` à `block_exercise_id` nul s'affiche en solo sans crash.
- [ ] Tests vitest : regroupement des set_logs par bloc, rendu de la carte.

## References

- Epic Brief : story 18
- Tech Plan : § Component Architecture (`BlockHistoryCard`), § Data Model (`ON DELETE SET NULL`)
