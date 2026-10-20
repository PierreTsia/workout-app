# T705 — Écriture de l'ancre de progression

## Goal

Fermer la boucle : une décharge appliquée par le moteur intra-séance (`computeCascadeSuggestions`)
devient l'ancre de la prochaine prescription. Couvre les stories 1, 2 et 4 de l'Epic Brief.

## Mode

AFK.

## Slice

`SetsTable.confirmRir` (dérive l'ancre) → payload → `syncService.processSetLog` → DB → tests

## Dependencies

T704

## Scope

### Dérivation (SetsTable)

> **Écart au Tech Plan, validé en cours de TDD** : l'ancre est **dérivée au log**, pas stampée sur le
> row. Pas de champ `SessionSetRowReps`, pas de stamp dans la cascade, pas d'effacement dans
> `updateField`.

- `confirmRir` (`file:src/components/workout/SetsTable.tsx`) : `anchorReps = reps du row si
  `Number(reps)` ≠ `prescriptionForLog.reps` et `!currentSet.manuallyEdited`, sinon `null``.
- L'édition manuelle (`updateField`) pose déjà `manuallyEdited` → exclue automatiquement, donc un
  « miss » tapé par l'athlète ne devient jamais l'ancre.
- La cascade moteur ne pose pas `manuallyEdited` → capturée automatiquement.

### Payload & persistance

- `SetLogPayloadReps` (`file:src/lib/syncService.ts`) : `anchorReps?: number | null`.
- `confirmRir` (`SetsTable.tsx`) : porter `anchorReps` dans le payload.
- `processSetLog` (`file:src/lib/syncService.ts`) : écrire `anchor_reps` sur la branche reps ; la
  branche durée laisse NULL.

### Tests

- SetsTable : une série dont les reps diffèrent de la prescription verrouillée, sans `manuallyEdited`,
  porte `anchorReps` ; une série `manuallyEdited` ne le porte pas.
- `processSetLog` : `anchor_reps` écrit (reps), NULL (durée et payload legacy).
- La chaîne complète (dérivation → persistance → lecture T704) tient la boucle ; un E2E Playwright
  dédié n'est pas jugé nécessaire à ce grain.

## Out of Scope

- P2, P3, P4 ; l'axe durée.
- La télémétrie (T706).

## Acceptance Criteria

- [x] Un test prouve qu'une série dont les reps diffèrent de la prescription verrouillée (move moteur)
      porte `anchorReps`, et qu'elle atteint `volume.current` de la séance suivante (via T704).
- [x] Un test prouve qu'une série `manuallyEdited` (un « miss » tapé) ne porte pas d'ancre.
- [x] Les payloads legacy sans `anchorReps` restent tolérés (`anchor_reps = NULL`).
- [x] La branche durée écrit `anchor_reps = NULL`.

## References

- Epic Brief `docs/Epic_Brief_—_Fermeture_de_la_boucle_de_progression_#705.md` (stories 1, 2, 4)
- Tech Plan `docs/Tech_Plan_—_Fermeture_de_la_boucle_de_progression_#705.md` §Component
  Responsibilities, §Failure Mode Analysis
- T704
