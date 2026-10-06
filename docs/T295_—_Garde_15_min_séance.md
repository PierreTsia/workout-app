# T295 — Garde 15 min de temps caché pour la séance

## Goal

Remplacer l'auto-pause immédiate de #655 par une garde de 15 min de temps caché :
un passage en arrière-plan ≤ 15 min compte dans `active_duration_ms`, au-delà tout
l'intervalle est exclu. L'auto-reprise au retour ne touche jamais une pause
manuelle. Adresse les user stories 1, 2, 6, 8 de l'Epic Brief.

## Dependencies

None.

## Scope

### `src/lib/session.ts`

- Exporter `VISIBILITY_GUARD_MS = 15 * 60 * 1000`.
- `pauseSessionForVisibility(prev, now)` : inchangé (pause si active et non
  pausée, `pausedByVisibility = true`).
- Nouveau `resumeSessionFromVisibilityPause(prev, now, thresholdMs)` :
  - no-op si `!prev.pausedByVisibility` ou `pausedAt == null` (pause manuelle
    préservée) ;
  - `hiddenDuration = now - pausedAt` ;
  - replie `hiddenDuration` dans `accumulatedPause` **seulement si**
    `hiddenDuration > thresholdMs` ;
  - efface `pausedAt` et `pausedByVisibility`.

### `src/hooks/useSessionVisibilityAutoPause.ts`

- `hidden` → `pauseSessionForVisibility`.
- `visible` → `resumeSessionFromVisibilityPause`.
- Appel initial au mount (résout une pause de garde persistée).

### `src/components/SessionTimerChip.tsx`

- Listener `visibilitychange` → `setNow(Date.now())` quand `visible` (tick forcé).

## Out of Scope

- Le repos (`useRestTimer`) → T296.
- ADR + glossaire → T297.
- `DurationSetTimer`, `BlockClock`, self-heal 3 h.

## Acceptance Criteria

- [ ] Caché ≤ 15 min : `accumulatedPause` inchangé (l'intervalle compte).
- [ ] Caché > 15 min : `accumulatedPause += hiddenDuration` (intervalle exclu).
- [ ] Une pause manuelle survit à un cycle hidden/visible sans être reprise.
- [ ] Une pause de garde persistée est reprise au mount si visible.
- [ ] `SessionTimerChip` force un tick sur `visibilitychange` → `visible`.
- [ ] `npm test`, `npx tsc -b`, `npm run lint` verts.

## References

- Epic Brief `file:docs/Epic_Brief_—_Timers_en_arrière-plan_#664.md`
- Tech Plan `file:docs/Tech_Plan_—_Timers_en_arrière-plan_#664.md`
- #655 (remplacé), #664
