# T706 — Télémétrie des règles servies

## Goal

Instrumenter le préalable de mesure du brief : distribution des règles servies, longueur des runs
`HOLD_INCOMPLETE`, `PLATEAU` jamais résolus. Couvre la story 10 de l'Epic Brief.

## Mode

AFK.

## Slice

`useProgressionSuggestion` → `progressionRuleTelemetry` → `analytics_events` → doc des requêtes SQL

## Dependencies

None

## Scope

### Émetteur

- `file:src/lib/progressionRuleTelemetry.ts` : insère un événement `analytics_events` de
  `event_type = 'progression_rule_served'`.
- Payload : `{ rule, volumeType, workoutExerciseId, exerciseId, sessionId }` — aucun email, aucune note.
- **Best-effort** : une erreur d'insertion n'est jamais remontée à l'appelant.

### Couture

- Appel depuis `useProgressionSuggestion` (in-session, la règle effectivement servie), **une seule fois
  par slot et par séance** — jamais depuis le batch pré-séance (évite le double comptage).

### Read path

- Documenté dans `file:docs/Observatory_—_Progression_Rules.md` (patron
  `file:docs/Observatory_—_Deviations.md`) : (a) distribution des règles ;
  (b) longueur des runs `HOLD_INCOMPLETE` (gaps-and-islands sur `workoutExerciseId`) ;
  (c) slots dont le dernier événement est `PLATEAU`.

## Out of Scope

- Toute surface in-app.
- P2, P3, P4.
- Des événements dédiés pour (b) et (c) — elles se dérivent en SQL.

## Acceptance Criteria

- [x] Un événement `progression_rule_served` est émis par slot et par séance servie.
- [x] Le payload contient `rule`, `volumeType`, `workoutExerciseId`, `exerciseId`, `sessionId`.
- [x] Aucune erreur d'insertion ne remonte à l'UI.
- [x] Aucun double comptage (couture unique in-session).
- [x] Les 3 requêtes de lecture sont documentées et exécutables
      (`file:docs/Observatory_—_Progression_Rules.md`).

## References

- Epic Brief `docs/Epic_Brief_—_Fermeture_de_la_boucle_de_progression_#705.md` (story 10)
- Tech Plan `docs/Tech_Plan_—_Fermeture_de_la_boucle_de_progression_#705.md` §Key Decisions (métriques),
  §Metric read path
- `docs/Observatory_—_Deviations.md`
