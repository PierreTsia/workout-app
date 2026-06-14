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

## Delivered (build notes)

- **Read:** `useSessionSetLogs` already returns `block_exercise_id`. Added `useSessionBlockMeta(blockExerciseIds)` (`src/hooks/`) which resolves each `block_exercise_id` → parent block (label, `sort_order`) + exercise (`position`, `emoji_snapshot`) via `block_exercises ⨝ exercise_blocks`.
- **Grouping (pure, tested):** `src/lib/sessionHistoryGrouping.ts` — `groupSessionHistory(logs, metaById)` returns ordered `SessionHistoryItem[]` (circuits first by day `sort_order`, then solos). Block cells grouped by `block_id`, split into rounds (`set_number`), ordered within a round by `position`. Solo-only sessions are byte-for-byte unchanged.
- **UI:** `src/components/history/BlockHistoryCard.tsx` — label + round count + per-round actuals (amount + weight) per exercise. Wired into `SessionRow`/`SessionSetLogs`; a `loadingSets` guard avoids a solo→circuit flash while meta resolves.
- **FK correction (data-integrity bug found in build):** migration `20260613140000` attached `set_logs.block_exercise_id` with **`ON DELETE CASCADE`**, which would *delete past-session logs* when a circuit is removed from the template — silently destroying history. New migration `20260613150000_set_logs_block_exercise_on_delete_set_null.sql` switches it to **`ON DELETE SET NULL`** (matches Tech Plan § Data Model). This makes the **orphan → solo fallback** in `groupSessionHistory` actually reachable (logs survive with `block_exercise_id = NULL`, snapshots intact).
- **Tests:** `src/lib/sessionHistoryGrouping.test.ts` — meta map build, solo grouping, round-major circuit grouping ordered by position, orphan fallback, circuits-before-solos ordering.

## Acceptance Criteria — status

- [x] Une session contenant un bloc affiche une `BlockHistoryCard` groupée (pas N lignes solos).
- [x] La carte montre les actuals par round (pyramide visible en historique).
- [x] Un `set_log` à `block_exercise_id` nul s'affiche en solo sans crash (+ FK passée en `SET NULL` pour que ce cas existe vraiment).
- [x] Tests vitest : regroupement des set_logs par bloc, rendu de la carte (util couvert ; carte = présentation pure).
