# Epic Brief — Timers en arrière-plan (#664)

## Summary

En séance, les timers de séance et de repos doivent continuer à s'écouler quand
l'utilisateur change d'application ou verrouille son écran. Aujourd'hui le timer
de séance est **auto-pausé immédiatement** au passage en arrière-plan (#655), ce
qui exclut à tort une courte récup téléphone-en-poche du temps de séance. On
remplace cette pause immédiate par une **garde de 15 minutes de temps caché** :
un passage en arrière-plan de 15 min ou moins compte (séance + repos) ; au-delà,
tout l'intervalle est exclu de `active_duration_ms`. Au retour, l'affichage se
recalcule immédiatement depuis les timestamps, un repos terminé en fond est
affiché terminé, et une pause manuelle n'est jamais écrasée.

---

## Context & Problem

**Who is affected:** tout utilisateur qui lance une **Session** et pose son
téléphone (écran verrouillé, changement d'app, appel) pendant la séance.

**Current state:**
- Le timer de **repos** (`useRestTimer`) est timestamp-based : sa valeur survit
  au passage en fond, seul le `setInterval` de rafraîchissement est throttlé.
- Le timer de **séance** (`SessionTimerChip` → `getEffectiveElapsed`) est aussi
  timestamp-based, mais `useSessionVisibilityAutoPause` (#655) le met en pause
  dès `visibilitychange` → `hidden`, et replie tout l'intervalle dans
  `accumulatedPause` au retour.
- Conséquence prod : 6 séances > 12 h, jusqu'à 19 h, parce qu'une pause manuelle
  oubliée ou un long abandon n'était pas le seul cas — le moindre verrouillage
  d'écran était exclu.

**Pain points:**

| Pain | Impact |
|---|---|
| Une récup téléphone-en-poche est exclue du temps de séance | `active_duration_ms` sous-estimé, stats de durée faussées |
| Le repos est gelé pendant un court passage en fond | le compte à rebours ne reflète pas le temps réel au retour |
| L'affichage peut rester figé jusqu'au prochain tick | l'utilisateur voit une valeur périmée au retour |

---

## User Stories

1. As an athlete mid-session, I want a short screen-lock (≤ 15 min) to count as
   session time, so that a phone-in-pocket rest is not silently erased.
2. As an athlete mid-session, I want a long abandonment (> 15 min) to be excluded
   from `active_duration_ms`, so that a forgotten session does not inflate my
   stats.
3. As an athlete mid-session, I want the rest timer to keep counting through a
   short background span, so that the countdown matches real time on return.
4. As an athlete mid-session, I want the session and rest displays to refresh
   immediately on return, so that I never read a stale value.
5. As an athlete mid-session, I want a rest that finished while backgrounded to
   show as finished on return, without restarting, so that I am not confused.
6. As an athlete who paused manually, I want my manual pause to survive a
   background/foreground cycle, so that the app never resumes against my will.
7. As an athlete mid-session, I want the rest-finished alert to fire on return
   when it could not fire in the background, so that I still get the cue.
8. As an athlete, I want the existing 3 h orphan self-heal to keep working
   unchanged, so that abandoned sessions are still closed at app open.

### Success measures

| Story # | Measure |
|---|---|
| 1, 2 | Unit tests: hidden ≤ 15 min → `accumulatedPause` unchanged ; hidden > 15 min → `accumulatedPause += hiddenDuration` |
| 3, 4 | Hook tests: forced tick on `visibilitychange` → `visible` for both timers |
| 6 | Hook test: manual pause survives hide/return untouched |

---

## Scope

**In scope:**
- Garde de 15 min de temps caché dans `src/lib/session.ts` + `useSessionVisibilityAutoPause`.
- Auto-reprise au retour d'une pause posée par la garde, jamais d'une pause manuelle.
- Tick forcé sur `visibilitychange` → `visible` pour `SessionTimerChip` et `useRestTimer`.
- Repos : un court passage en fond compte ; un repos fini en fond s'affiche terminé.
- Alerte de fin de repos best-effort (déclenchée par le tick de retour), sans Web Push.
- Mise à jour du glossaire **Session time** et ADR `0029-inactivity-guard-15min.md`.

**Out of scope:**
- `DurationSetTimer` et `BlockClock` (timers distincts, non touchés).
- Web Push / notification native en arrière-plan.
- Le self-heal 3 h (`orphanSessionClose.ts`, `ORPHAN_SESSION_THRESHOLD_MS`) — inchangé.
- Toute écriture DB / migration.

---

## Success Criteria

- **Numeric:** `npm test` vert ; `npx tsc -b` sans erreur ; `npm run lint` sans erreur.
- **Qualitative:** un passage en arrière-plan ≤ 15 min compte dans la séance et le
  repos ; > 15 min est exclu de `active_duration_ms` ; une pause manuelle survit ;
  les deux affichages se recalculent au retour ; le repos fini en fond s'affiche
  terminé sans redémarrer.
