# T707 — Décharge in-session : règle `DELOAD` + lecture N séances + libellé

## Goal

Le moteur inter-séance prescrit une **Décharge** (`DELOAD`) sur un **Exercise Slot** bloqué — 4 séances
consécutives où la cible **servie** (`anchor_reps ?? prescribed_reps`, et `prescribed_weight`) ne bouge
pas, la dernière à **RIR moyen ≤ 1** — et cette cible plus légère arrive **dans la séance en cours**,
avec son **libellé « Décharge »**. Couvre les stories 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14 de
l'Epic Brief.

> Le libellé est **dans ce ticket** : `ProgressionPill.test.tsx` type sa fixture en
> `Record<ProgressionRule, …>` (exhaustif) et `tsconfig.app.json` inclut les tests — ajouter `DELOAD` à
> l'enum **casse `tsc`** sans toucher la fixture ; et sans les clés, `t(reasonKey)` retombe sur
> `progression.deload` à l'écran.

## Mode

AFK.

## Slice

`migration RPC` → `arch test` → `useSlotPrescriptionHistory` → `shouldDeload` + `DELOAD` +
`ProgressionPrescription.useSnapshot` (`file:src/lib/progression.ts`) + export
`PROPORTIONAL_DELOAD_FACTOR` (`file:src/lib/rirSuggestion.ts`) → seam `useProgressionSuggestion` →
prefill `SetsTable` → `ProgressionPill` (icône/couleur/auto-appliquée) → clés `{en,fr}/workout.json` →
vitest.

## Dependencies

None.

## Scope

### Migration + RPC

- `supabase/migrations/20261021120000_slot_prescription_history.sql` : la RPC
  `get_slot_prescription_history(p_workout_exercise_ids, p_exercise_ids, p_before, p_limit)` du Tech Plan
  — `SECURITY INVOKER`, `STABLE`, `GRANT EXECUTE … TO authenticated`, filtre `s.user_id = auth.uid()`,
  filtre `sl.duration_seconds IS NULL`, `sl.prescribed_reps IS NOT NULL`, **colonnes aliasées**
  (`we_id`/`ex_id`/`sess_id`), filtre `last_logged_at < p_before` appliqué **avant** le `row_number()`.

### Arch test + appel réel

- `src/test/slotPrescriptionHistory.arch.test.ts` : la fonction existe, est `SECURITY INVOKER`, est
  `GRANT`ée à `authenticated`, filtre sur `auth.uid()`, exclut l'axe durée, borne la fenêtre avant le
  ranking.
- **Un appel réel** de la RPC (test d'intégration ou requête locale sur un slot à ≥ 2 séances) : le test
  d'arch ne lit que le texte de la migration et ne peut pas attraper une erreur plpgsql — et le hook
  avale l'erreur, donc un RPC cassé serait invisible.

### Hook

- `src/hooks/useSlotPrescriptionHistory.ts` : entrée `{ workoutExerciseId, exerciseId }[]` + `before?`
  → `Map<slotKey, SlotSessionSummary[]>`. **Erreur ou RPC absente → `Map` vide** (jamais de throw vers
  l'UI).

### Engine

- `file:src/lib/progression.ts` : `DELOAD` ajouté à `ProgressionRule` ; `useSnapshot: boolean` sur
  `ProgressionPrescription` (déjà calculé dans `buildPrescription`) ; type `SlotSessionSummary`
  (`sessionFinishedAt`, `prescribedReps`, `anchorReps`, `prescribedWeight`, `avgRir`) ; `STALL_SESSIONS = 4` ;
  `shouldDeload(sessions)` ; `computeNextSessionTarget(prescription, lastPerformance, opts?: { stallHistory? })` ;
  branche `DELOAD` **en tête**, gardée par `prescription.useSnapshot === true`, `reasonKey:
  "progression.deload"`, `delta: "—"`.
- `file:src/lib/rirSuggestion.ts` : exporter `PROPORTIONAL_DELOAD_FACTOR`.

### Seam in-session

- `file:src/hooks/useProgressionSuggestion.ts` : lit l'historique avec `before = sessionStartedAt`, passe
  `stallHistory` au moteur (l'`equipment` est déjà passé à `buildPrescription` ici).

### Pastille + chaînes

- `file:src/components/workout/ProgressionPill.tsx` : `ICON_MAP.DELOAD = TrendingDown`,
  `COLOR_MAP.DELOAD = bg-muted text-muted-foreground border-border`, `APPLIED_RULES` inclut `DELOAD`.
- `src/locales/en/workout.json` et `src/locales/fr/workout.json` : les deux clés du contrat i18n, **valeurs
  exactes** (aucune réécriture) :

| Key | EN | FR |
|---|---|---|
| `progression.deload` | Deload | Décharge |
| `progression.deloadDetail` | Your target hasn't moved in a while and you're training close to failure. A lighter session to recover — just this once. | Ta cible ne bouge plus depuis un moment et tu t'entraînes proche de l'échec. Séance plus légère pour récupérer — juste cette fois. |

### Tests

- `src/lib/progression.test.ts` : `shouldDeload` — déclenche à 4 séances de cible **égale** + RIR ≤ 1 ;
  `false` à < 4 ; `false` si une cible de la fenêtre **avance** ; `false` si une cible **chute** (décharge
  servie ou changement manuel) ; `false` si `avg_rir` `null` ou `> 1` ; la cible lue est
  `anchor_reps ?? prescribed_reps`. Branche `DELOAD` : weight-first `currentWeight − weightIncrement`
  (plancher incrément), reps-only `max(1, min(round(reps×0.85), reps−1))`. Manual Override Window
  (`useSnapshot === false`) → pas de décharge. Les tests existants passent `opts` `undefined` et gardent
  leur comportement.
- `src/components/workout/ProgressionPill.test.tsx` : fixture `DELOAD` (couleur neutre, pas de delta,
  détail visible, `aria-label` en compact).
- `src/locales/locales.test.ts` : parité EN/FR (générique, doit rester vert).

## Out of Scope

- Le seam pré-séance (`useProgressionSuggestionsForDay`) (T708).
- L'axe durée (hors v1) et tout état persisté.
- Un gloss parentétique du mot « Deload » (pas de place en mode compact ; le popover contextualise).

## Acceptance Criteria

- [ ] La migration crée `get_slot_prescription_history` (`SECURITY INVOKER`, `GRANT authenticated`,
      colonnes aliasées) et l'arch test passe.
- [ ] **Un appel réel de la RPC réussit** (pas seulement le test d'arch textuel).
- [ ] `shouldDeload` couvre les 6 cas (égalité, < N, avancée, chute, RIR `null`, RIR `> 1`) par des tests
      rouges→verts.
- [ ] Sur un slot bloqué, la séance en cours pré-remplit la charge −1 incrément (weight-first) ou les reps
      ×0,85 (reps-only).
- [ ] La Manual Override Window supprime la décharge (le template gagne) ; la séance suivant une décharge
      servie reprend la règle normale.
- [ ] La pastille affiche « Décharge » (+ détail au tap, `aria-label` en compact), EN et FR présentes.
- [ ] RPC en erreur ou absente → aucune décharge, suggestions normales (dégradation sûre).
- [ ] `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm test` verts.

## References

- Epic Brief `docs/Epic_Brief_—_Sortie_de_blocage_(décharge_planifiée)_#705.md`
- Tech Plan `docs/Tech_Plan_—_Sortie_de_blocage_(décharge_planifiée)_#705.md` (§Key Decisions, §Data Model, §Component Responsibilities, §Failure Mode Analysis, §i18n contract)
- ADR `docs/adr/0033-plateau-exit-triggered-by-prescription-stall.md`, ADR `docs/adr/0032-progression-anchor-reps.md`