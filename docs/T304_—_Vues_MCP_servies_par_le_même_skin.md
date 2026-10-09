# T304 — Vues MCP servies par le même skin

## Goal

Faire lire aux vues MCP **le même artefact CSS** que l'app (`glSkin.generated.css`) au lieu du défaut du cœur, et régénérer les vues. Couvre les stories 1 et 12 : app et cartes dérivent du même skin ; le document de vue reste auto-suffisant.

## Mode

AFK — un changement de source dans le script de build + régénération + test.

## Slice

`scripts/build-mcp-view.mjs → vues *.generated.ts → arch tests vues`

## Dependencies

T303 (l'artefact `glSkin.generated.css` doit exister).

## Scope

### `scripts/build-mcp-view.mjs`

- Remplacer `const TOKENS_CSS = readFileSync(require.resolve('@nomosui/react/tokens/tokens.generated.css'), 'utf8')` par la lecture de `path.join(ROOT, 'src/styles/glSkin.generated.css')`.
- `VIEW_CSS` (utilitaires compilés `@nomosui/react/view.css`) et le reste du build inchangés.

### Artefacts

- Rejouer `npm run build:view` et **committer** `supabase/functions/mcp/resources/views/sessionCard.generated.ts` et `programPatch.generated.ts`.

### CI

- `.github/workflows/ci.yml` : exécuter `glSkin:check` **avant** `view:check` (l'artefact vue dépend du skin).

### Arch tests vues

- Étendre `src/test/mcpSessionCard.arch.test.ts` (et le pendant program-patch) : `build-mcp-view.mjs` référence `glSkin.generated.css` et **plus** `tokens.generated.css`.

## Out of Scope

- Retrait du `@theme` legacy (T306).
- Contenu/design des cartes (aucun changement).
- Le test de parité global app↔vue (T307).

## Acceptance Criteria

- [ ] `npm run build:view` régénère les deux artefacts ; seule la source CSS change (mêmes valeurs).
- [ ] `npm run view:check` est vert sur l'artefact committé.
- [ ] `scripts/build-mcp-view.mjs` ne référence plus `tokens.generated.css`.
- [ ] `npm test` vert (arch tests vues étendus).

## References

- Epic Brief `file:docs/Epic_Brief_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (stories 1, 12)
- Tech Plan `file:docs/Tech_Plan_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (§ Component Architecture, Modified Files)
- ADR `file:docs/adr/0027-agentic-view-contract.md` §5
