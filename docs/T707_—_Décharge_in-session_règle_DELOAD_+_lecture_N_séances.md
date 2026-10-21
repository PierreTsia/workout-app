# T707 — Décharge in-session : règle `DELOAD` + lecture N séances

## Goal

Le moteur inter-séance prescrit une **Décharge** (`DELOAD`) sur un **Exercise Slot** bloqué — 4 séances
consécutives où `prescribed_reps` **et** `prescribed_weight` n'avancent pas, la dernière à **RIR moyen
≤ 1** — et cette cible plus légère arrive **dans la séance en cours**. Couvre les stories 1, 3, 4, 5, 6,
8, 9, 10, 11, 12, 13, 14 de l'Epic Brief. Pose aussi les entrées **mécaniques** de la pastille (icône,
couleur, auto-appliquée) pour que le pill ne casse pas avant les chaînes (T709).

## Mode

AFK.

## Slice

`migration RPC` → `arch test` → `useSlotPrescriptionHistory` → `shouldDeload` + branche `DELOAD`
(`file:src/lib/progression.ts`) + export `PROPORTIONAL_DELOAD_FACTOR` (`file:src/lib/rirSuggestion.ts`) →
seam `useProgressionSuggestion` → prefill `SetsTable` → pastille mécanique (`ProgressionPill`) → vitest.

## Dependencies

None.

## Scope

### Migration + RPC

- `supabase/migrations/20261021120000_slot_prescription_history.sql` : la RPC
  `get_slot_prescription_history(p_workout_exercise_ids, p_exercise_ids, p_before, p_limit)` du Tech Plan
  — `SECURITY INVOKER`, `STABLE`, `GRANT EXECUTE … TO authenticated`, filtre `s.user_id = auth.uid()`,
  filtre `sl.duration_seconds IS NULL`, `sl.prescribed_reps IS NOT NULL`, filtre `last_logged_at < p_before`
  appliqué **avant** le `row_number()`.

### Arch test

- `src/test/slotPrescriptionHistory.arch.test.ts` : la fonction existe, est `SECURITY INVOKER`, est
  `GRANT`ée à `authenticated`, filtre sur `auth.uid()`, exclut l'axe durée, et borne la fenêtre avant le
  ranking.

### Hook

- `src/hooks/useSlotPrescriptionHistory.ts` : entrée `{ workoutExerciseId, exerciseId }[]` + `before?`
  → `Map<slotKey, SlotSessionSummary[]>`. **Erreur ou RPC absente → `Map` vide** (jamais de throw vers
  l'UI).

### Engine

- `file:src/lib/progression.ts` : `DELOAD` ajouté à `ProgressionRule` ; type `SlotSessionSummary` ;
  `STALL_SESSIONS = 4` ; `shouldDeload(sessions)` ; `computeNextSessionTarget(prescription,
  lastPerformance, opts?: { stallHistory?, equipment? })` ; branche `DELOAD` **en tête**, gardée par
  `useSnapshot === true`.
- `file:src/lib/rirSuggestion.ts` : exporter `PROPORTIONAL_DELOAD_FACTOR`.

### Seam in-session

- `file:src/hooks/useProgressionSuggestion.ts` : lit l'historique avec `before = sessionStartedAt`,
  passe `stallHistory` + `equipment` au moteur.

### Pastille (mécanique, sans chaîne)

- `file:src/components/workout/ProgressionPill.tsx` : `ICON_MAP.DELOAD = TrendingDown`,
  `COLOR_MAP.DELOAD = bg-muted text-muted-foreground border-border`, `APPLIED_RULES` inclut `DELOAD`.

### Tests

- `src/lib/progression.test.ts` : `shouldDeload` — déclenche à 4 séances stagnantes + RIR ≤ 1 ; `false`
  à < 4 ; `false` si la dernière transition chute (décharge servie) ; `false` si `avg_rir` `null` ou
  `> 1` ; `false` si une séance de la fenêtre avance. Branche `DELOAD` : weight-first
  `currentWeight − weightIncrement` (plancher incrément), reps-only `max(1, min(round(reps×0.85), reps−1))`.
  Manual Override Window ouverte → pas de décharge. Les tests existants passent `opts` `undefined` et
  gardent leur comportement.

## Out of Scope

- Les chaînes i18n et le détail du popover (T709).
- Le seam pré-séance (`useProgressionSuggestionsForDay`) (T708).
- L'axe durée (hors v1) et tout état persisté.

## Acceptance Criteria

- [ ] La migration crée `get_slot_prescription_history` (`SECURITY INVOKER`, `GRANT authenticated`) et
      l'arch test passe.
- [ ] `shouldDeload` couvre les 5 cas par des tests rouges→verts.
- [ ] Sur un slot bloqué (4 séances stagnantes, RIR ≤ 1), la séance en cours pré-remplit la charge −1
      incrément (weight-first) ou les reps ×0,85 (reps-only).
- [ ] La Manual Override Window supprime la décharge (le template gagne).
- [ ] La séance suivant une décharge servie reprend la règle normale (pas de re-décharge).
- [ ] RPC en erreur ou absente → aucune décharge, suggestions normales (dégradation sûre).
- [ ] `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm test` verts.

## References

- Epic Brief `docs/Epic_Brief_—_Sortie_de_blocage_(décharge_planifiée)_#705.md`
- Tech Plan `docs/Tech_Plan_—_Sortie_de_blocage_(décharge_planifiée)_#705.md` (§Key Decisions, §Data Model, §Component Responsibilities, §Failure Mode Analysis)
- ADR `docs/adr/0033-plateau-exit-triggered-by-prescription-stall.md`