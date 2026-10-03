# T284 — Walking skeleton : Session Card statique rendue dans Claude

## Goal

Prouver de bout en bout la chaîne **build → artefact committé → ressource MCP → outil `_meta` → iframe sandboxé** en rendant dans Claude une **Session Card** GL-skinnée (briques Nomos) avec des **données d'exemple**. Couvre les stories 1, 2, 6, 7, 10, 11 de l'Epic Brief. Le contrat est figé par l'ADR `file:docs/adr/0027-agentic-view-contract.md`.

## Mode

**AFK** — aucun choix d'architecture restant ; les critères sont mécaniquement vérifiables (test + `view:check` + rendu dans un hôte).

## Slice

`scripts/build-mcp-view.mjs` → `src/mcp-views/session-card/{SessionCard.tsx, render.ts, entry.tsx}` → `supabase/functions/mcp/resources/views/sessionCard.generated.ts` → `resources/sessionCardView.ts` + `resources/registry.ts` → `ToolDefinition.meta` + `tools/renderSessionCard.ts` + `tools/registry.ts` → `src/test/mcpSessionCard.arch.test.ts` + job CI `view:check`.

## Dependencies

Aucune. Premier slice du chemin critique.

## Scope

### Build de vue — `scripts/build-mcp-view.mjs`

- Assemble un **HTML auto-suffisant** : markup **SSR** (`renderToStaticMarkup`) + **CSS Tailwind GL** + **bundle JS IIFE** (React + `@modelcontextprotocol/ext-apps` + `SessionCard`) minifié.
- CSS : entrée dédiée important `tailwindcss`, `@nomosui/react/tokens/tokens.generated.css`, `@nomosui/react/tokens/theme.css`, avec `@source` sur `src/mcp-views/**` et sur les sources Nomos (l'app compile déjà via `postcss.config.js` / `@tailwindcss/postcss`).
- Écrit `supabase/functions/mcp/resources/views/sessionCard.generated.ts` (constante string, **Deno-safe**) ; `--check` régénère en mémoire et diff, exit non-zéro si dérive.
- npm : `"build:view": "node scripts/build-mcp-view.mjs"`, `"view:check": "node scripts/build-mcp-view.mjs --check"`.
- **devDependency** `@modelcontextprotocol/ext-apps` (build-time only).

### Source de la vue — `src/mcp-views/session-card/`

| Fichier | Rôle |
|---|---|
| `SessionCard.tsx` | Le composant carte (Nomos `Card` / `Badge` / `Meter`), **data-fed par props**, sans i18n/react-query/router |
| `render.ts` | `renderToStaticMarkup(<SessionCard … />)` pour le repli sans JS (état d'exemple) |
| `entry.tsx` | Entrée iframe : `App` (`@modelcontextprotocol/ext-apps`), handshake `ui/initialize`, monte `SessionCard` (props d'exemple à ce stade) |

### Serveur MCP

- Élargir `ToolDefinition` (`file:supabase/functions/mcp/tools/registry.ts:35`) : `meta?: { ui?: { resourceUri: string } }` ; elargir le retour du handler avec `structuredContent?: unknown` **sans** casser les 11 outils.
- Nouveau `tools/renderSessionCard.ts` : `render_session_card`, `annotations: { title, readOnlyHint: true, idempotentHint: true }`, `meta.ui.resourceUri: 'ui://gymlogic/session-card'`, texte de résumé (exemple).
- Nouveau `resources/sessionCardView.ts` : `ResourceDefinition` `ui://gymlogic/session-card`, `name`, `description`, `mimeType: 'text/html;profile=mcp-app'`, handler renvoyant l'artefact (ignore `supabase`) ; l'enregistrer dans `resources/registry.ts`.
- Aucun changement de `index.ts` (le `_meta` remonte déjà via le rest-spread de `registry.ts:65`).

### CI

- Ajouter un job **`view-check`** (`.github/workflows/ci.yml`) et l'ajouter aux `needs` de `gate`.

### Tests

- `src/test/mcpSessionCard.arch.test.ts` : la ressource est listée avec `mimeType: text/html;profile=mcp-app` ; l'outil porte `meta.ui.resourceUri` et `readOnlyHint: true` ; l'artefact est non périmé ; aucun chemin d'écriture.

## Out of Scope

- Données réelles et liaison par pont (`structuredContent` → vue) → **T285**.
- Locale `en|fr` et noms localisés → **T286**.
- `SKILL.md` → **T287**.
- QA dans un vrai hôte → **T288**.
- Toute interactivité / écriture depuis une vue.

## Acceptance Criteria

- [ ] Dans **Claude Desktop**, demander à voir une séance affiche la **Session Card GL-skinnée** (données d'exemple) inline.
- [ ] `resources/list` contient `ui://gymlogic/session-card` avec `mimeType: text/html;profile=mcp-app`.
- [ ] `tools/list` contient `render_session_card` avec `meta.ui.resourceUri` **et** `readOnlyHint: true`.
- [ ] Le HTML de la vue contient un token `--nomos-color-*` et le teal GL.
- [ ] `npm run view:check` passe en local **et** en CI (job ajouté à `gate`).
- [ ] Un client qui ignore `_meta` reçoit toujours un `tools/list` valide et un résultat texte.
- [ ] `@modelcontextprotocol/ext-apps` est **build-time only** (absent du bundle SPA).
- [ ] Aucun chemin d'écriture dans la vue ni dans l'outil.

## References

- Epic Brief `file:docs/Epic_Brief_—_Surface_agentique_Nomos_#591.md` (stories 1, 2, 6, 7, 10, 11)
- Tech Plan `file:docs/Tech_Plan_—_Surface_agentique_Nomos_#591.md` (§ Architectural Approach, Component Architecture)
- ADR `file:docs/adr/0027-agentic-view-contract.md`
- MCP Apps : https://modelcontextprotocol.io/extensions/apps/overview
