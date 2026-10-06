# T296 — Repos : court passage en fond et ticks au retour

## Goal

Faire compter un court passage en arrière-plan (≤ 15 min) dans le timer de repos,
forcer un tick immédiat au retour, et déclencher l'alerte de fin de repos
best-effort quand elle n'a pas pu partir en fond. Adresse les user stories 3, 4,
5, 7 de l'Epic Brief.

## Dependencies

T295 (le seuil `VISIBILITY_GUARD_MS` et la sémantique de pause de garde).

## Scope

### `src/store/atoms.ts`

- Ajouter `pausedForVisibility?: boolean` à `RestState`.

### `src/hooks/useRestTimer.ts`

- Dans le `useLayoutEffect` de pause de séance : poser
  `pausedForVisibility = session.pausedByVisibility`.
- Au retour de pause : replier `pauseDuration` **seulement si** la pause n'est
  pas une pause de visibilité, ou si `pauseDuration > VISIBILITY_GUARD_MS`.
- Listener `visibilitychange` → `tick()` quand `visible` (tick forcé + alerte
  best-effort si le repos est fini).

## Out of Scope

- Web Push / notification native en arrière-plan.
- `DurationSetTimer`, `BlockClock`.
- Le comportement de pause manuelle du repos (inchangé).

## Acceptance Criteria

- [ ] Un repos en cours compte un passage en fond ≤ 15 min (pas de repli).
- [ ] Un passage en fond > 15 min est replié dans `accumulatedPause` du repos.
- [ ] Une pause manuelle de séance replie toujours (comportement existant).
- [ ] `visibilitychange` → `visible` force un tick du repos.
- [ ] Un repos fini en fond s'affiche terminé au retour, sans redémarrer.
- [ ] `npm test`, `npx tsc -b`, `npm run lint` verts.

## References

- Epic Brief `file:docs/Epic_Brief_—_Timers_en_arrière-plan_#664.md`
- Tech Plan `file:docs/Tech_Plan_—_Timers_en_arrière-plan_#664.md`
- T295
