# T292 — Pont partagé + carte de patch (`ui://gymlogic/program-patch`)

## Goal

Livrer le 2ᵉ composite : une **carte de décision** qui rend l'aperçu d'`update_program` et, au clic **Valider**, émet une intention `tools/call apply_program_patch` via l'hôte. Le pont MCP Apps est extrait en module partagé. Epic [#643](https://github.com/PierreTsia/workout-app/issues/643).

## Mode

HITL — la copie de la carte et l'eyeball visuel (états, densité) se font avec l'artefact en main, pass `microcopy` + revue. L'ossature technique est AFK.

## Slice

resource (`programPatchView`) → view (`src/mcp-views/program-patch/*`) → pont partagé (`tools/call`, erreurs) → build (`build-mcp-view.mjs` paramétré) → artefact committé → i18n → arch test.

## Dependencies

T290 (contrat), T291 (serveur : token + `_meta.ui.resourceUri`).

## Scope

### Pont partagé — `src/mcp-views/bridge.ts`

- Extraire de `src/mcp-views/session-card/bridge.ts` vers un module partagé (le 2ᵉ composite justifie l'extraction).
- Ajouter : `request(method, params, timeoutMs)` rejetant sur `error` JSON-RPC ; `callTool(name, args)` → `tools/call`.
- Gérer `result.isError` (HTTP 200 + `isError:true`) distinct d'une erreur transport.
- La Session Card importe le module partagé ; elle n'appelle jamais `callTool` (read-only).
- Tests : handshake, tool-result, rejet sur `error`, timeout.

### Ressource + vue

- `supabase/functions/mcp/resources/programPatchView.ts` : `uri: "ui://gymlogic/program-patch"`, mime `text/html;profile=mcp-app`, renvoie l'artefact (statique, sans auth).
- Enregistrer dans `resources/registry.ts`.
- `src/mcp-views/program-patch/entry.tsx` : reçoit `structuredContent`, monte `ProgramPatchCard`.
- `ProgramPatchCard.tsx` : états **preview** (aperçu `rendered` + `removed_days`/`added_days` + warnings + bouton Valider), **applying**, **applied** (résultat `status:"applied"`), **erreur**. Au clic : `bridge.callTool("apply_program_patch", { preview_token })`.
- `render.tsx` (SSR repli, état vide), `types.ts` (payload), `labels.ts` (importe `src/locales`).
- Aucun `fetch`, aucun `insert/update/delete` dans `src/mcp-views/`.

### Build — `scripts/build-mcp-view.mjs`

- Paramétrer sur une liste `[session-card, program-patch]` (entrée, render, artefact cible, nom de const).
- Écrire `supabase/functions/mcp/resources/views/programPatch.generated.ts` ; `view:check` couvre les deux artefacts.

### i18n

- Namespace `mcpView` — clés du Tech Plan (`patch.title/apply/applying/applied/error/removedDays_one|_other/addedDays_one|_other`), EN+FR, parité via `locales.test.ts`. Pass `microcopy` HITL.

## Out of Scope

- Le token serveur et l'outil `apply_program_patch` → T291.
- Les autres composites (Program card, History) et le skin GL nommé.
- Toute autre surface que `update_program`.

## Acceptance Criteria

- [ ] La carte se rend dans un hôte MCP Apps avec la donnée réelle d'un `update_program{dry_run:true}` (Claude Desktop, vérifié en T294).
- [ ] Le bouton Valider appelle `tools/call apply_program_patch` avec le `preview_token` reçu ; l'état passe preview → applying → applied.
- [ ] Un token invalide/expiré affiche l'état **erreur** ; la carte ne reste jamais bloquée en « applying » (timeout du pont).
- [ ] `src/mcp-views/` ne contient aucun chemin d'écriture directe (test d'arch).
- [ ] `npm run view:check` vert pour **les deux** artefacts (session-card + program-patch).
- [ ] Clés EN + FR présentes et conformes au contrat i18n ; `locales.test.ts` vert.
- [ ] La Session Card fonctionne toujours via le pont partagé (non-régression).

## References

- Epic [#643](https://github.com/PierreTsia/workout-app/issues/643) · Tech Plan `file:docs/Tech_Plan_—_Agentic_components_show_act_#643.md` (Component Architecture, i18n contract)
- `file:src/mcp-views/session-card/bridge.ts` · `file:scripts/build-mcp-view.mjs` · `file:supabase/functions/mcp/resources/sessionCardView.ts` · skill `microcopy`
