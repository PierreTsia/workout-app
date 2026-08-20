# T141 — Session nav refactor → items[] + Round Screen (display)

## Goal

Faire entrer les blocs dans l'exécution de séance : refactorer `WorkoutPage` d'une liste plate d'exercices vers une **séquence d'items** (solo | bloc), et afficher un **Round Screen** dédié (`BlockRunner`) montrant les exos du round courant avec **leurs chiffres de ce round**. Volontairement **sans logging persistant** pour isoler le risque de la refacto. Couvre les stories 11 (Round Screen) et 15 (chiffres par round).

## Mode

**HITL** — c'est le ticket le plus risqué : la refacto `WorkoutPage` ne doit **pas** régresser les séances 100 % solo, et la navigation round-by-round (layout du Round Screen, représentation d'un bloc dans le strip) est l'UX la plus sensible — à valider avec l'écran en main.

## Slice

`useDayItems (session)` → refacto `WorkoutPage` flat→`items[]` → `ExerciseStrip` chip bloc → `BlockRunner` + `RoundView` + `blocksData` atom (UI only) → vitest

## Dependencies

T138, T139.

## Scope

### `WorkoutPage` refactor

- Remplace `exercises: WorkoutExercise[]` par `items: DayItem[]` (via `useDayItems`).
- `session.exerciseIndex` indexe désormais les **items** ; un bloc = 1 item.
- Quand l'item actif est un bloc → rend `BlockRunner` au lieu de `ExerciseDetail`.
- **Non-régression solo** : un jour sans bloc se comporte exactement comme avant (strip, nav, `SetsTable`, finish).

### `ExerciseStrip`

- Un item-bloc rend une **chip unique groupée** (visuel distinct, exos empilés/condensés).

### `BlockRunner` + `RoundView` (display)

- État local `roundIndex` + `positionInRound` (ne touche pas `session.exerciseIndex`).
- `RoundView` affiche les exos du round courant avec `per_round[roundIndex]` (amount + poids).
- Navigation visuelle entre rounds (avancer/reculer) — **sans** écrire de `set_logs` ni armer de timer à ce stade.
- `sessionAtom` += `blocksData: Record<blockExerciseId, RoundCell[]>` (structure d'état, alimentée en UI, persistée localement).

## Out of Scope

- Logging `set_logs` + migration `block_exercise_id` → **T142**.
- Timers rest/transition → **T142**.
- Exclusion progression → **T142**.

## Acceptance Criteria

- [ ] Une séance 100 % solo est identique à avant (aucune régression strip/nav/log/finish).
- [ ] Une séance contenant un bloc affiche le `BlockRunner` quand l'item actif est ce bloc.
- [ ] Le strip rend le bloc comme une chip unique parmi les solos, dans le bon ordre.
- [ ] Le Round Screen montre les exos du round courant avec les chiffres de CE round (pyramide visible : round 1 ≠ round 2).
- [ ] Avancer de round met à jour les chiffres affichés ; `blocksData` reflète l'état (persisté en local).
- [ ] Tests vitest : construction `items[]`, sélection d'item, rendu round-by-round (chiffres par round).

## References

- Epic Brief : stories 11, 15 ; Success criteria (non-régression solo)
- Tech Plan : § Component Architecture (`BlockRunner`, `RoundView`, session state), § Critical Constraints (`session.exerciseIndex`)

## Delivered beyond original scope (build notes)

Implementation diverged/extended from the planned cut; recorded here so docs stay truthful:

- **Naming — "Circuit" not "Block" in UI.** All user-facing copy says *Circuit* (FR & EN); "block" stays internal (code, i18n keys). Codified in ADR 0007 §Decision.5 + `CONTEXT.md`.
- **Session block as a first-class carousel item** (`BlockSessionCard` + `buildSessionItems`), not just a strip chip — a block occupies one slot in Prev/Next, with a Start that launches the full-screen runner.
- **`BlockRunner` polish:** countdown ring for duration holds (clockwise, 12-o'clock start, idle/active states), three-state duration button (Start → Skip → Log, no auto-advance), optimistic "logged" badge on back-nav, screen wake-lock, prominent round/exercise progress bars, and a **cancel-circuit** confirm dialog that clears the circuit's queued/persisted `set_logs` (`discardBlockSetLogs`).
- **Pre-session preview handles circuits (Epic story 23, no dedicated ticket):**
  - `PreSessionExerciseList` renders circuits read-only, interleaved with solos by `sort_order` (`BlockSessionCard` gains an optional `onStart` + `className`).
  - `WorkoutDayCard` muscle map + "X exercice / ~Y séries" chips fold in block exercises (`useAggregatedMuscles(exercises, blocks)`, each block exercise weighted by `rounds`).
  - `canStartPreSession(exercises, blocks)` makes a circuits-only day startable while keeping the "every solo needs ≥1 set" guard.
