# T184 — Round Screen GO + clock chrome

## Goal

Tout Circuit (d’abord **Tours** / Zeus) part sur un **3-2-1-GO** poli, puis la première station. L’horloge est du **chrome** non tappable ; le hero reste le amount de la station. Elapsed **Tours** = display-only, wall-clock (la pause séance ne gèle pas le chrome). L’historique **Tours** reste ADR 0008 dérivé. Couvre les stories 8, 10, 11.

## Mode

**AFK** — primitives existantes (`CountdownRing`) ; polish visuel recetté en **T190**.

## Slice

`CountdownRing` → `BlockGoCountdown` → `BlockClockChrome` (elapsed) → `BlockRunner` + `WorkoutPage` → vitest

## Dependencies

None. (Pas de `mode` requis : Zeus suffit. Countdown AMRAP → **T185**.)

## Scope

### `file:src/components/workout/BlockGoCountdown.tsx`

- Overlay 3-2-1-GO réutilisant `CountdownRing` (même famille que le hold solo).
- Après GO : première station. **Pas** de 2ᵉ GO dans ce ticket (Tours n’a pas de **Block Run**).
- Jour Cindy-only : le **Démarrer** séance reste en amont (`canStartPreSession` déjà OK) ; ce ticket ne touche pas le pre-session.

### `file:src/components/workout/BlockClockChrome.tsx`

- Variante **elapsed** seulement. Départ = instant du GO (mémoire ; kill-app Tours peut perdre l’elapsed — accepté, pas de `block_runs` Tours).
- **Wall-clock** : ignore `session.accumulatedPause` / `SessionTimerChip`. La pause ne gèle pas le chrome.
- Non interactif : hors hit-target de Valider. Station amount = hero.

### `file:src/components/workout/BlockRunner.tsx`

- Phase `go` avant `exercise`. Clock chrome persistante pendant `exercise` / timers.
- Skip, rest, transition, logging : **inchangés** (Tours).

## Out of Scope

- Countdown cap AMRAP, `started_at` persisté, leftover, no-Skip → **T185**.
- `block_runs` writes → **T185**.
- Persister l’elapsed **Tours** (ADR 0008) — **interdit**.
- Builder / MCP.

## Acceptance Criteria

- [ ] Ouvrir Zeus → 3-2-1-GO → station 1 ; Valider n’est pas le timer.
- [ ] Chrome elapsed avance pendant une pause séance (wall-clock).
- [ ] Finir Zeus : historique CCT toujours `MAX−MIN(logged_at)`, aucun row `block_runs`.
- [ ] Kill-app mid-Zeus : pas de régression logging (comportement T142) ; elapsed chrome peut reset — documenté, pas un bug T184.
- [ ] Tests vitest : phase `go` → `exercise` ; clock non cliquable (rôle / pointer-events).

## References

- Epic Brief : stories 8, 10, 11
- Tech Plan : Tours GO mémoire seulement ; clock chrome ; pause ≠ `SessionTimerChip`
- ADR 0008 (Tours derived) + 0014 (AMRAP only persists a clock)
