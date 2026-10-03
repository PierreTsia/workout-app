# T287 — `SKILL.md` : outil + ressource

## Goal

Documenter la nouvelle surface agentique dans le skill public : l'outil `render_session_card` et la ressource `ui://gymlogic/session-card`. Le skill fait partie du produit (AGENTS.md) et se met à jour avec les outils.

## Mode

**AFK** — le contrat est figé par T284–T286 ; la rédaction est mécanique.

## Slice

`skills/gymlogic-mcp/SKILL.md` (table intent → tool + section ressources) et, si pertinent, une note dans `README.md`.

## Dependencies

**T286** (contrat de données et locale figés).

## Scope

- Ajouter `render_session_card` à la table **intent → tool** (intent : « montre ma dernière séance »), avec : lecture seule, rend une **carte** dans un hôte MCP Apps, repli texte pour les autres clients.
- Ajouter une entrée près de la mention de ressource (`SKILL.md:97`) pour `ui://gymlogic/session-card` (`text/html;profile=mcp-app`).
- Mettre à jour le compte d'outils (« eleven tools… ») → douze, si la phrase est chiffrée.
- Ne décrire **que** le contrat implémenté (aucun comportement inventé).

## Out of Scope

- Toute modification de code.
- La QA dans un vrai hôte → **T288**.

## Acceptance Criteria

- [ ] `skills/gymlogic-mcp/SKILL.md` documente `render_session_card` (intent, lecture seule, vue + repli texte).
- [ ] La ressource `ui://gymlogic/session-card` est mentionnée (URI + mime).
- [ ] Le compte d'outils est cohérent (douze).
- [ ] Aucune affirmation au-delà du contrat implémenté.

## References

- Epic Brief `file:docs/Epic_Brief_—_Surface_agentique_Nomos_#591.md` (scope item 8)
- Tech Plan `file:docs/Tech_Plan_—_Surface_agentique_Nomos_#591.md`
- `file:skills/gymlogic-mcp/SKILL.md`
