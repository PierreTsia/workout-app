# T705 — Écriture de l'ancre de progression

## Goal

Fermer la boucle : une décharge appliquée par le moteur intra-séance (`computeCascadeSuggestions`)
devient l'ancre de la prochaine prescription. Couvre les stories 1, 2 et 4 de l'Epic Brief.

## Mode

AFK.

## Slice

`sessionSetRow` → `SetsTable` (stamp + clear) → payload → `syncService.processSetLog` → DB → test E2E

## Dependencies

T704

## Scope

### Row

- `SessionSetRowReps` (`file:src/lib/sessionSetRow.ts`) : `anchorReps?: number`.

### Stamp (SetsTable)

- À l'application de la cascade (`file:src/components/workout/SetsTable.tsx:566-570`) : poser
  `anchorReps = suggestion.reps` sur les rows déplacées — jamais sur celles filtrées par
  `manuallyEdited` (`:544-549`).
- `updateField` (édition manuelle) : effacer `anchorReps` en même temps que `manuallyEdited = true`.
- **Ne pas** stamper l'auto-apply (`:207-299`) : il applique la prescription de début de séance, qui
  **est** le pristine.

### Payload & persistance

- `SetLogPayloadReps` (`file:src/lib/syncService.ts`) : `anchorReps?: number`.
- `confirmRir` (`SetsTable.tsx`) : porter `anchorReps` dans le payload.
- `processSetLog` (`file:src/lib/syncService.ts:1213`) : écrire `anchor_reps` sur la branche reps ; la
  branche durée laisse NULL.

### Tests

- Test d'intégration bout-en-bout : une décharge appliquée à la série N → la prescription suivante
  repart de l'ancre.
- Miss sans move moteur → aucune ancre → snapshot inchangé.

## Out of Scope

- P2, P3, P4 ; l'axe durée.
- La télémétrie (T706).

## Acceptance Criteria

- [ ] Un test prouve qu'une décharge intra-séance appliquée atteint `volume.current` de la séance
      suivante.
- [ ] Un test prouve qu'une série seulement *manquée* (aucun move moteur) ne pose pas d'ancre.
- [ ] Une ré-édition manuelle d'une série déplacée efface l'ancre (la valeur de l'athlète gagne).
- [ ] Les payloads legacy sans `anchorReps` restent tolérés.
- [ ] La branche durée écrit `anchor_reps = NULL`.

## References

- Epic Brief `docs/Epic_Brief_—_Fermeture_de_la_boucle_de_progression_#705.md` (stories 1, 2, 4)
- Tech Plan `docs/Tech_Plan_—_Fermeture_de_la_boucle_de_progression_#705.md` §Component
  Responsibilities, §Failure Mode Analysis
- T704
