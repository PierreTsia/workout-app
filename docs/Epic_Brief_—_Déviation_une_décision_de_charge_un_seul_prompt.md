# Epic Brief — Déviation : une décision de charge, un seul prompt

## Summary

Quand un athlète s'écarte de sa **Prescription Snapshot** sur plusieurs séries
consécutives à la **même charge**, l'app redemande aujourd'hui la **Deviation
Reason** à chaque série. Une seule décision de charge produit donc N prompts et N
events. On capture la raison **une fois par décision** : le prompt ne revient que
si la charge change à nouveau.

---

## Context & Problem

**Who is affected:** tout athlète qui log une charge différente de la prescription
(typiquement une prescription à 0 sur un premier exercice) et la conserve sur les
séries suivantes.

**Current state:**
- `SetsTable.confirmRir` (`file:src/components/workout/SetsTable.tsx`) compare
  **chaque** série à la **Prescription Snapshot** via `isLoadDeviation`
  (`file:src/lib/deviationCapture.ts`) et ouvre `DeviationReasonSheet` à chaque fois.
- La comparaison « série vs prescription » et la détection d'« un nouveau
  changement de charge entre séries » sont confondues.
- Conséquence : le sheet réapparaît à chaque série identique, et
  `session_deviation_events` reçoit un event par série au lieu d'un par décision.

**Pain points:**
| Pain | Impact |
|---|---|
| Re-prompt à chaque série identique | friction, geste répété sans nouvelle information |
| Un event par série | la métrique « adoption du tap » de l'observatoire (#609) compte des séries, pas des décisions |
| Confusion des deux comparaisons | le code ne sait pas distinguer « déviation » de « nouvelle décision » |

---

## User Stories

1. As an athlete, I want the reason sheet to appear **once** when I change a load,
   so that I don't re-tap the same reason on every set at the same weight.
2. As an athlete, I want the sheet to come back when I change the load **again**,
   so that a genuinely new decision is still captured.
3. As an athlete, I want no prompt when I merely repeat the previous set's load,
   so that logging a straight-set run is uninterrupted.
4. As an athlete who returns to the prescription, I want the stale deviation to be
   dropped, so that my debrief doesn't show an adjustment I undid.
5. As an athlete, I want a reps-only deviation to follow the same rule as a
   weight deviation, so that the behavior is consistent across axes.
6. As the Observatory owner, I want one event per load decision (not per set), so
   that the tap-adoption metric measures taps, not inheritance.
7. As an athlete whose first set is at the prescription and whose second set
   deviates, I want the prompt on that second set, so that the decision is captured
   even without a prior deviation in the exercise.
8. As an athlete on a duration exercise, I want no behavior change, so that the
   load-deviation rule stays scoped to reps rows.

### Success measures

| Story # | Measure |
|---|---|
| 6 | `session_deviation_events` rows = number of distinct load decisions, not sets |

Stories without a numeric measure are validated qualitatively via the story itself.

---

## Scope

**In scope:**
- A "new load decision" predicate: the current set's `(weight, reps)` differs from
  the **previous logged set** of the same exercise.
- The sheet opens only on a deviation **and** a new load decision.
- A continuation set records **no** event (the decision is already captured).
- Return-to-prescription stale deletion unchanged.

**Out of scope:**
- Any schema or queue change.
- Changing the observatory promotion threshold (#609).
- Editing the reason of an already-captured decision from a later set.
- Duration exercises (no load-deviation prompt today).

---

## Success Criteria

- **Numeric:** on a 3-set run at an identical deviated load, exactly one
  `session_deviation_events` row is written and the sheet opens once.
- **Qualitative:** a load change after a continuation re-opens the sheet, and
  returning to the prescription clears the stale event.