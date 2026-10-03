# T289 — Adopter `@nomosui/react` 0.9.0

## Goal

Bumper le pin exact `@nomosui/react` **`0.8.0` → `0.9.0`** pour disposer de la surface agentique livrée par Nomos : `@nomosui/react/view` (`renderView`, `APP_VIEW_MIME`, `appViewUri`, `compositeViewUri`), `@nomosui/react/view.css` (utilitaires compilés) et le dialecte MCP Apps (ADR 0033). Prerequis de **T284**.

## Mode

**AFK** — bump + lockfile + vérifications ; aucun choix d'architecture.

## Slice

`package.json` (pin exact) + `package-lock.json` → `npm test` / `lint` / typecheck → tests Deno → vérification qu'aucun usage de `resolveSkin` / `TokensDocument` / littéraux `ui://` maison n'existe côté GL.

## Dependencies

Aucune.

## Scope

- Mettre à jour le pin exact `@nomosui/react` à `0.9.0` (0.x = breaking sur minor) et régénérer le lockfile.
- **Breaking 0.9.0 à vérifier** : `TokensDocument` devient un document fermé et `resolveSkin` change de signature (ADR 0034, note de migration). GL n'appelle pas `resolveSkin` et n'utilise pas `TokensDocument` (il importe seulement les CSS de tokens dans `file:src/styles/globals.css`) — le confirmer par un `grep` (`resolveSkin`, `TokensDocument`) et par la suite de tests.
- Vérifier que les nouveaux sub-exports résolvent depuis le paquet installé : `@nomosui/react/view` et `@nomosui/react/view.css`.
- Passer `npm test`, `npm run lint`, le typecheck, et les tests Deno (`supabase/functions/**/*_test.ts`).

## Out of Scope

- **Consommer** `renderView` / `view.css` (c'est **T284**) ; le bump ne fait qu'activer la dépendance.
- Toute modification de la carte, de l'outil ou de la ressource.

## Acceptance Criteria

- [ ] `package.json` pinne `@nomosui/react` **`0.9.0`** (exact).
- [ ] `package-lock.json` régénéré ; `npm ci` propre.
- [ ] `npm test`, `npm run lint`, le typecheck et les tests Deno verts.
- [ ] `grep` prouve l'absence d'usage de `resolveSkin` / `TokensDocument` / littéraux `ui://` maison (`set-view`, `set-data`, `source:'nomos'`) dans `src/` et `supabase/`.
- [ ] `@nomosui/react/view` et `@nomosui/react/view.css` résolvent depuis le paquet installé.

## References

- Nomos v0.9.0 : https://github.com/PierreTsia/nomos/releases/tag/v0.9.0 (ADR 0033 bridge MCP Apps, ADR 0034 view entry + utilities)
- Epic Brief `file:docs/Epic_Brief_—_Surface_agentique_Nomos_#591.md` (scope item 10)
- Tech Plan `file:docs/Tech_Plan_—_Surface_agentique_Nomos_#591.md` (§ Key Decisions, Dépendance)
- ADR `file:docs/adr/0027-agentic-view-contract.md`
