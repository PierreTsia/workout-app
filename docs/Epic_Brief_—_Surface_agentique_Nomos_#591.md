# Epic Brief — Surface agentique Nomos : une Session Card rendue dans la conversation MCP (#591)

## Summary

GymLogic est MCP-native mais « fin » sur l'axe agentique : 11 outils, 1 ressource JSON, rien qu'un hôte puisse **rendre**. Cet epic ouvre la **surface agentique** — des composites GymLogic réels affichés dans la conversation d'un **External MCP Client** (Claude Desktop et mobile), bâtis sur les briques Nomos et le skin GL. La première tranche : un outil dédié `render_session_card` qui renvoie la **dernière Session** de l'athlète et déclenche une **Session Card** lecture seule, servie en `text/html;profile=mcp-app` via `_meta.ui.resourceUri`, rendue en iframe sandboxé, alimentée par le pont MCP Apps standard (`ext-apps`). Ce qui change pour l'utilisateur : demander « montre ma dernière séance » à Claude affiche une carte identique à l'app, dans le fil de conversation.

Contrat tranché en amont : ADR `file:docs/adr/0027-agentic-view-contract.md`.

---

## Context & Problem

**Who is affected:** l'athlète GymLogic qui branche un **External MCP Client** (Claude Desktop / mobile) ; l'**agent** (LLM) qui doit décrire un état sans écran ; l'équipe (CI / maintenance de l'artefact de vue).

**Current state:**
- Le serveur MCP expose `tools` (11) + `resources` (`exercise_catalog_schema`), aucune vue, aucun prompt.
- `@nomosui/react` est consommé app-side (phase 1 #583, pinné `0.8.0`). **Nomos 0.9.0** livre la surface agentique : le pont parle le dialecte MCP Apps standard (ADR 0033) et le paquet expose `@nomosui/react/view` (`renderView`) + `@nomosui/react/view.css` (utilitaires compilés, ADR 0034). Mais `renderView` ne rend que des **briques/scènes du catalogue** (app-agnostique), **pas** une carte produit GymLogic.
- GymLogic doit donc **monter sa propre carte** à partir de ces briques partagées ; `_meta`, ressource et outil restent du MCP GL à écrire. Le paquet est pinné `0.8.0` → bump `0.9.0` requis.
- GymLogic n'a **pas de skin** : `file:src/styles/globals.css` peint l'app depuis son `@theme` legacy vendoré, alors que les tokens **par défaut** du cœur portent déjà l'identité GL (teal `174 100% 39%`).

**Pain points:**
| Pain | Impact |
|---|---|
| Le produit ne rend rien dans la conversation | Le différenciateur MCP-native reste invisible ; l'agent décrit en prose ce qu'il pourrait montrer |
| Aucune carte produit dans Nomos | `renderView` ne rend que des briques/scènes app-agnostiques ; GL doit assembler sa propre carte et son document de vue |
| Pas de skin GL nommé | La claim « identique à l'app par construction » est fausse aujourd'hui (coïncidence de valeurs) |

---

## User Stories

1. As an **athlete in Claude**, I want to ask "show my last session" and see my **real** most recent Session rendered as a card inline, so that I read my training at a glance without opening the app.
2. As an **athlete in Claude mobile**, I want the same Session Card to render on my phone, so that the surface is not desktop-only.
3. As an **athlete with no finished Session**, I want the card to show an honest empty state ("no sessions yet"), so that I never see a fabricated zero.
4. As an **athlete**, I want the card's facts (day label, exercises / **Circuits**, **Tonnage**) to match the app's own session view for that session, so that I trust what the agent shows me.
5. As an **athlete**, I want nothing the card does to write to my account, so that showing a view can never mutate my data.
6. As an **athlete on a client that ignores `_meta`** (Cursor, Le Chat), I want `render_session_card` to still return a readable text summary, so that my client never breaks.
7. As an **agent**, I want the tool to return a compact, structured summary alongside the view reference, so that I can reason about the session without parsing HTML.
8. As an **athlete with a FR app locale**, I want the card's labels in French, so that the surface follows my language.
9. As an **athlete**, I want the card to survive a slow or failed data fetch with a legible state, so that I never see a blank or a crash in the conversation.
10. As a **maintainer**, I want the committed view artifact checked in CI, so that it cannot silently drift from its source.
11. As a **maintainer**, I want the resource to advertise `text/html;profile=mcp-app` and the tool to carry `_meta.ui.resourceUri`, so that the MCP Apps contract is provable by test.

### Success measures

| Story # | Measure |
|---|---|
| 1, 2 | Card renders in Claude Desktop **and** claude.ai mobile (hand-verified at least once) |
| 1, 4 | Card data derives from the same session grain as the app (day label / circuits / tonnage), not a second computation |
| 6 | Non-MCP-Apps client still gets a valid `tools/list` + text result (arch test) |
| 5, 10 | Zero write path from a view; `view:check` green in CI |
| 8 | FR and EN labels both verified |

---

## Scope

**In scope:**
1. **ADR GL 0027** — contrat agentique : dialecte MCP Apps standard, URI `ui://gymlogic/…`, `_meta.ui.resourceUri`, lecture seule, Nomos source visuelle, claim skin dégradée. *(écrit)*
2. **Serveur MCP** : champ `_meta` sur `ToolDefinition` (remonté par `tools/list`) ; ressource `ui://gymlogic/session-card` servie en `text/html;profile=mcp-app` par `resources/read`.
3. **Outil dédié** `render_session_card` (`readOnlyHint: true`, sans paramètre requis) : renvoie la **dernière Session terminée** de l'athlète (même chemin de données que `get_workout_history`) en résumé texte/structuré, et porte `_meta.ui.resourceUri`.
4. **Pont MCP Apps** : la vue est bâtie sur `@modelcontextprotocol/ext-apps` (`App`) — handshake `ui/initialize`, réception du tool result, rendu ; **aucun** `callTool` d'écriture.
5. **Un composite vertical** : la **Session Card** (`Card` / `Badge` / `Meter` Nomos), alimentée par les données réelles.
6. **i18n EN + FR** : libellés injectés, branchés sur les clés app existantes.
7. **Build de vue GL** : artefact committé (`scripts/build-mcp-view.mjs`, Vite lib + `react-dom/server` + **`@nomosui/react/view.css`**) + `view:check` en CI.
8. **Skill** : `skills/gymlogic-mcp/SKILL.md` décrit la nouvelle surface (contrat public).
9. **Tests** : contrat MCP (profil `mcp-app`, `_meta` présent, aucune écriture), dérive de l'artefact, et la vue reçoit bien le tool result et rend la donnée.
10. **Dépendance** : bump `@nomosui/react` `0.8.0` → `0.9.0` (T289, prérequis).

**Out of scope:**
- Toute **interactivité / écriture** depuis une vue (« modifier séance ») — ADR + consentement #287 dédiés.
- La **PWA/Jev comme hôte** MCP Apps ; SSE (#266) ; Jev (#552).
- Le **cœur Nomos** lui-même (vit dans `PierreTsia/nomos`) : son bridge MCP Apps ([nomos#99](https://github.com/PierreTsia/nomos/issues/99), ADR 0033) et l'entrée de vue + utilitaires ([nomos#100](https://github.com/PierreTsia/nomos/issues/100), ADR 0034) sont **livrés en 0.9.0** — l'adoption du paquet côté GL est couverte ici (T289), le cœur ne bouge pas.
- Le **vrai skin GL** (`resolveSkin` consommé par app **et** vue) — après retirement du `@theme` legacy.
- Les autres composites (carte de programme, etc.).

---

## Success Criteria

- **Numeric:** **1** composite `ui://gymlogic/…` rendu dans Claude Desktop avec la **donnée réelle** de l'athlète ; `view:check` et la suite MCP verts ; **0** chemin d'écriture depuis une vue.
- **Qualitative:** l'agent peut *montrer* une séance, pas seulement la décrire ; le contrat MCP Apps est prouvé par test (`mimeType`, `_meta.ui.resourceUri`, échange tool result → vue) et les clients non-MCP-Apps restent fonctionnels ; `SKILL.md` reflète la nouvelle surface.
