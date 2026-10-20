# T704 — Lecture de l'ancre de progression

## Goal

Rendre l'ancre lisible par le moteur : colonne `set_logs.anchor_reps`, exposée par la RPC, lue par
`buildPrescription` (`anchor_reps ?? prescribed_reps`) sur la série au `set_number` max. Livré **inerte**
(aucun writer) : le comportement reste celui d'aujourd'hui. Couvre les stories 5 et 7 de l'Epic Brief.

## Mode

AFK.

## Slice

`migration (colonne + RPC)` → `useLastSessionDetail` + `useProgressionSuggestionsForDay` →
`src/lib/progression.ts` → `vitest` + test d'arch

## Dependencies

None

## Scope

### Migration

- `supabase/migrations/2026…_progression_anchor_reps.sql` :
  `ALTER TABLE public.set_logs ADD COLUMN anchor_reps integer;`
- `DROP FUNCTION IF EXISTS` puis `CREATE FUNCTION` (`CREATE OR REPLACE` est **impossible** : ajouter
  une colonne en sortie change le type de retour), corps **exact** de
  `supabase/migrations/20260808115507_fix_slot_rpc_rir_cast.sql` plus `anchor_reps` au `RETURNS TABLE`
  et au `SELECT`, puis re-`GRANT EXECUTE ... TO authenticated`.

| Item | Detail |
|---|---|
| Colonne | `set_logs.anchor_reps integer`, nullable, sans backfill, sans CHECK |
| RPC | `anchor_reps` ajouté à `RETURNS TABLE` + `SELECT` ; signature et corps sinon inchangés |

### Engine

- `SetPerformance` (`file:src/lib/progression.ts`) : `setNumber?: number`, `anchorReps?: number | null`.
- `pickAnchorSet(sets)` : la série au `setNumber` max ; fallback premier élément quand aucun
  `setNumber` (callers legacy).
- Chemin reps **snapshot** : `anchorReps ?? prescribedReps` pour `volume.current`. La Manual Override
  Window reste prioritaire (chemin template). `prescribed_sets`, axe durée et axe poids inchangés.

### Hooks

- `useLastSessionDetail` et `useProgressionSuggestionsForDay` : mapper `set_number → setNumber` et
  `anchor_reps → anchorReps` dans `SetPerformance` (les deux, pour que la lecture soit
  ordre-indépendante).

### Types & tests

- `file:src/types/database.ts` : `SetLog.anchor_reps: number | null`.
- Tests unitaires (`file:src/lib/progression.test.ts`) : précédence (ancre > snapshot),
  ordre-indépendance (ASC vs DESC), repli (NULL → snapshot).
- `file:src/test/setLogsAnchor.arch.test.ts` : la colonne existe et la RPC la renvoie.

## Out of Scope

- Le writer (T705) — aucune ancre n'est encore écrite.
- L'axe durée (`anchor_duration_seconds`).
- La télémétrie (T706).

## Acceptance Criteria

- [x] `anchor_reps` existe sur `set_logs` et `get_last_performance_for_slots` la retourne.
- [x] Un test prouve `volume.current = ancre` de la série au `setNumber` max.
- [x] Un test prouve un résultat identique quel que soit l'ordre du tableau de séries.
- [x] Un test prouve le repli sur `prescribed_reps` quand l'ancre est NULL.
- [x] Le test d'arch échoue si la colonne ou la RPC perd `anchor_reps`.
- [~] Comportement inchangé quand tout est NULL — **vérifié**. Mais **des tests ont changé** :
      `SetLog` / `SetPerformance` gagnant un champ requis, 9 fixtures et 1 assertion de forme ont
      été complétées (compilation), sans changement de comportement.

## References

- Epic Brief `docs/Epic_Brief_—_Fermeture_de_la_boucle_de_progression_#705.md` (stories 5, 7)
- Tech Plan `docs/Tech_Plan_—_Fermeture_de_la_boucle_de_progression_#705.md` §Data Model, §Component
  Architecture
- Migration source `supabase/migrations/20260808115507_fix_slot_rpc_rir_cast.sql`
