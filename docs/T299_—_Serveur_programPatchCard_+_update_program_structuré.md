# T299 — Serveur : `programPatchCard` + `update_program` structuré

## Goal

Faire porter à `update_program` `dry_run:true` un `program` structuré (jours + exercices typés + champs changés) et une `locale`, **uniquement** dans `structuredContent`, sans toucher `rendered` ni `payload`. Epic [#651](https://github.com/PierreTsia/workout-app/issues/651), stories 2, 3, 5, 12.

## Mode

AFK — logique pure et contrat déjà figé (T298).

## Slice

`lib/programPatchCard.ts` (pur) → `tools/updateProgram.ts` → vitest (unitaire) + deno (handler).

## Dependencies

T298 (ADR 0031).

## Scope

### Builder pur — `file:supabase/functions/mcp/lib/programPatchCard.ts` (nouveau)

Types exportés (cf. Tech Plan, Data Model) : `PatchProgram`, `PatchDay`, `PatchExercise` = `PatchSoloExercise | PatchCircuitExercise`, `PatchChangeField` = `"sets" | "reps" | "weight" | "rest"`, `PatchLocale`.

`buildPatchProgram(diff, current, catalog)` — sans I/O :
- Jours = `days_to_update` + `days_to_insert` + `days_unchanged`, **`days_to_delete` exclus**, triés par `sort_order` (même ensemble et ordre que `formatProgramAfterUpdate`).
- `name` = `diff.name_change?.to ?? current.name`.
- Pour un jour **modifié** : apparier les solos de `current.workout_exercises` aux `parsed_exercises` par `exercise_id` puis `sort_order` (repli index, via `reconcileSolos` de `file:supabase/functions/mcp/lib/slotReconciliation.ts`), comparer `sets`, `reps` (normalisé), `weight` (string→nombre), `rest_seconds` → `change: PatchChangeField[] | null` (`null` si rien ne change).
- Un `bare` parsed (UUID seul) → `change: null` (absence de prescription ≠ modification).
- Un exercice d'un jour **inséré** → `isNew: true, change: null` ; d'un jour **inchangé** → `change: null`.
- Un solos retiré d'un jour modifié n'est **pas** ré-émis (v1 : couvert par les `warnings`).
- Circuit parsed → `kind: "circuit"` compact (`label`, `mode`, `capSeconds`, `rounds`, `exerciseCount`, `isNew`).

### Handler — `file:supabase/functions/mcp/tools/updateProgram.ts`

- Ajouter un argument optionnel `locale` (`enum ["en","fr"]`) à l'`inputSchema`.
- Résoudre la locale via `resolveCardLocale(args.locale, profileLocale)` (`file:supabase/functions/mcp/lib/sessionCard.ts:110`) ; `profileLocale` depuis `user_profiles.select("locale")` (même requête que `renderSessionCard`).
- Dans la branche `dry_run` (`:409-416`), ajouter `locale` et `program: buildPatchProgram(diff, currentProgram, catalogById)` **au seul `structuredContent`**. `payload` (donc `content[0].text`) et `rendered` inchangés.

### Tests

- `file:supabase/functions/mcp/lib/programPatchCard.test.ts` (vitest) — **écrit d'abord** : change detection par champ + normalisation (`"80"`=`80`, plage `"8-12"`), `isNew`, circuits compacts, deletes exclus, ordre, `bare` non annoté.
- `file:supabase/functions/mcp/tools/updateProgram_test.ts` (deno) — étendre : `structuredContent.program.days` + `structuredContent.locale` présents ; `content[0].text` **inchangé** (preuve d'additivité).

## Out of Scope

- Toute modification de la vue (→ T301).
- `rendered`, `payload`, `get_program_details`, `create_program`.
- Les exercices retirés d'un jour modifié (v1 : `warnings`).

## Acceptance Criteria

- [ ] `buildPatchProgram` est une fonction pure (aucun accès réseau/Supabase).
- [ ] Tests vitest du builder verts, y compris la normalisation des poids/plages et le skip `bare`.
- [ ] `update_program{dry_run:true}` renvoie `structuredContent.program` + `structuredContent.locale`.
- [ ] `content[0].text` et `rendered` sont **byte-identiques** à avant (test Deno).
- [ ] `days_to_delete` n'apparaît pas dans `program.days` ; l'ordre suit `rendered`.
- [ ] `deno test "supabase/functions/**/*_test.ts"` et `npm test` verts.

## References

- ADR 0031 `file:docs/adr/0031-decision-card-structured-program.md`
- Tech Plan `file:docs/Tech_Plan_—_Refinement_design_des_cartes_MCP.md` (Data Model, Tests)
- `file:supabase/functions/mcp/lib/format.ts:603`, `file:supabase/functions/mcp/lib/sessionCard.ts:110`, `file:supabase/functions/mcp/lib/slotReconciliation.ts`, `file:supabase/functions/mcp/tools/renderSessionCard.ts`
