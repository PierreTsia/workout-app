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

### Stamp par la cascade (SetsTable)

> **Design corrigé après revue Copilot.** Une première version *dérivait* l'ancre au log (« reps du
> row ≠ prescription et non `manuallyEdited` »). Elle était **fausse** : la cascade renvoie toujours
> `String(currentReps)`, donc un **miss** est recopié dans les séries suivantes sans `manuallyEdited`
> et se lit comme un move moteur. La décision se prend donc **là où l'information existe** : dans la
> cascade.

- `SessionSetRowReps` (`file:src/lib/sessionSetRow.ts`) : `anchorReps?: number`.
- La cascade stampe `anchorReps` sur les rows qu'elle déplace, **seulement** quand :
  - la série déclenchante a fait **exactement** la prescription (`triggering.reps === prescription`),
    et
  - `Number(suggestion.reps) ≠ prescription` (sinon la cascade **écho** la valeur de l'athlète, ou ne
    change rien).
- `updateField` (édition manuelle) remet `anchorReps: undefined` : l'intention de l'athlète gagne.
- `confirmRir` porte `currentSet.anchorReps ?? null` dans le payload — plus aucune comparaison au log.

### Payload & persistance

- `SetLogPayloadReps` (`file:src/lib/syncService.ts`) : `anchorReps?: number | null`.
- `processSetLog` (`file:src/lib/syncService.ts`) : écrire `anchor_reps` sur la branche reps ; la
  branche durée laisse NULL.

### Tests

- SetsTable : un **miss** écho par la cascade ne porte **pas** d'ancre (repro Copilot) ; un **déload
  reps-only** genuine (série déclenchante au plan, `rir 0`) porte l'ancre ; une série
  `manuallyEdited` ne la porte pas.
- `processSetLog` : `anchor_reps` écrit (reps), NULL (durée et payload legacy).
- La chaîne complète (stamp → persistance → lecture T704) tient la boucle ; un E2E Playwright dédié
  n'est pas jugé nécessaire à ce grain.

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
