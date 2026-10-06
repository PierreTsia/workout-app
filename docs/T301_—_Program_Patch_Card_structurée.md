# T301 — Program Patch Card structurée

## Goal

Rendre la **Decision Card** (`ui://gymlogic/program-patch`) comme une **vraie carte programme** : titre, statut, chips retrait/ajout, alertes, jours et lignes d'exercice avec prescription localisée et annotation des champs changés — au lieu du `<pre>` markdown. Epic [#651](https://github.com/PierreTsia/workout-app/issues/651), stories 4, 5, 6, 7, 8.

## Mode

AFK — décisions verrouillées ; QA visuelle réelle en T302.

## Slice

`program-patch/types.ts` → `ProgramPatchCard.tsx` → `labels.ts` + locales → `entry.tsx` / `render.tsx` → build → arch test.

## Dependencies

T299 (données `program`/`locale`), T300 (`styles.ts`).

## Scope

### Types — `file:src/mcp-views/program-patch/types.ts`

Ajouter (optionnels, rétrocompatibles) : `locale?: "en" | "fr"` et `program?: PatchProgram` (`name`, `days[]` avec exercices `solo | circuit`, `change` et `isNew`), en miroir de `lib/programPatchCard.ts` (T299).

### Composant — `file:src/mcp-views/program-patch/ProgramPatchCard.tsx`

Hiérarchie cible (maquette Stitch validée) :
`Kicker`(title) → `Heading`(program.name) → `Badge`(statut) → `Chip tone="danger"` (retraits) / `Chip tone="success"` (ajouts) → `Alert tone="warning"` (warnings, `title` requis) → liste jours (`Kicker` emoji+label) → lignes : `Text` nom en gras + `Text size="caption"` prescription muted (`·`) + annotation `change` (`mcpView.changed*`) → `Button` Apply.

- Prescription **reconstruite côté vue** depuis les champs typés (pas depuis le markdown) : `{{sets}} × {{reps}} mcpView.reps · {{kg}} kg · mcpView.rest {{s}} s` (durée : `{{sets}} × {{duration}}s`).
- Circuit → ligne compacte (label + mode `AMRAP 20 min` / `N tours` + `circuitExercises`), badge AMRAP + gloss (jamais nu).
- États `applying` / `applied` / `error` conservés ; bouton Apply gated sur `preview_token`.
- **Repli** : si `program` absent, retomber sur `rendered` / `message`.
- Importer `panel` depuis `styles.ts`.

### Locale & thème — `file:src/mcp-views/program-patch/entry.tsx`

- Locale depuis `payload.locale` (fin de `navigator.language`).
- `onHostContext` → `data-theme` (repli `dark`), comme T300.

### SSR — `file:src/mcp-views/program-patch/render.tsx` + `example.ts`

`example.ts` doit inclure un `program` d'exemple (jours/exercices) pour que le rendu SSR reflète la carte réelle.

### i18n — `file:src/locales/en/program.json` / `fr/program.json`

Ajouter les clés du contrat (Tech Plan, i18n contract) sous `mcpView` : `statusPreview`, `consentNote`, `changedSets`, `changedReps`, `changedWeight`, `changedRest`, `reps`, `rest`, `circuitExercises_one`, `circuitExercises_other`. Valeurs **copiées du contrat**, pas réinventées. `labels.ts` les expose.

### Build & test

- `npm run build:view` + commit `file:supabase/functions/mcp/resources/views/programPatch.generated.ts` ; `npm run view:check` vert.
- `file:src/test/mcpProgramPatch.arch.test.ts` : ajouter que la vue consomme `program` et rend les composants (Chip/Alert/Counter), sans chemin d'écriture (assertion existante à conserver).
- `file:src/locales/locales.test.ts` vert (parité EN/FR des nouvelles clés).

## Out of Scope

- Toute nouvelle carte programme lecture seule (`get_program_details`).
- Toute modification serveur (→ T299).
- Exercices retirés d'un jour modifié (v1 : `warnings`).

## Acceptance Criteria

- [ ] La carte rend `program.name` en `Heading` + `Kicker` titre + `Badge` statut.
- [ ] Les retraits/ajouts sont des `Chip tone="danger"/"success"` ; les warnings un `Alert tone="warning"`.
- [ ] Chaque ligne exercice affiche la prescription dans la **langue de `payload.locale`** (FR et EN vérifiés).
- [ ] Les champs changés affichent l'annotation `mcpView.changed*` ; un exercice inchangé n'en affiche pas.
- [ ] Circuit = ligne compacte avec badge AMRAP + gloss.
- [ ] `data-theme` suit l'hôte (repli `dark`) ; repli `rendered` si `program` absent.
- [ ] Nouvelles clés présentes en EN **et** FR ; `locales.test.ts` vert.
- [ ] `programPatch.generated.ts` rebuild + committé ; `view:check` et arch test verts.

## References

- Epic Brief `file:docs/Epic_Brief_—_Refinement_design_des_cartes_MCP.md` · issue [#651](https://github.com/PierreTsia/workout-app/issues/651)
- Tech Plan `file:docs/Tech_Plan_—_Refinement_design_des_cartes_MCP.md` (Component Architecture, i18n contract, Failure Mode Analysis)
- `file:src/mcp-views/program-patch/`, `file:scripts/build-mcp-view.mjs`, `file:src/test/mcpProgramPatch.arch.test.ts`, skill `microcopy`
