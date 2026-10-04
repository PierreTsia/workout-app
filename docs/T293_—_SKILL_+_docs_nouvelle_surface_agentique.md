# T293 — SKILL + docs : nouvelle surface agentique (carte + apply app-only)

## Goal

Mettre la documentation publique en lockstep avec le serveur : le **SKILL** décrit la carte de décision et `apply_program_patch`, et le blast radius `mcp-connect`/README est audité pour ne pas enseigner un flow interdit. Epic [#643](https://github.com/PierreTsia/workout-app/issues/643).

## Mode

AFK — rédaction factuelle, sources figées (T291/T292).

## Slice

docs (`skills/gymlogic-mcp/SKILL.md` → `docs/mcp-connect/*` → README → audit références). Aucun code produit.

## Dependencies

T291 (outil + `_meta`), T292 (vue livrée, pour décrire le rendu réel).

## Scope

### `skills/gymlogic-mcp/SKILL.md`

- Documenter : `update_program{dry_run:true}` → une **carte** rend l'aperçu dans un hôte MCP Apps ; le bouton **Valider** applique via `apply_program_patch` (`visibility:["app"]`, invisible du modèle).
- Rappeler que `update_program{dry_run:false}` **reste** le chemin des hôtes non-MCP-Apps (Cursor, Le Chat) — pas de régression.
- Le nouveau tableau outil → prompt (« montre-moi le changement » / carte).

### Audit du blast radius

- Vérifier/ajuster : `README.md`, `docs/mcp-connect/{claude-desktop,cursor,le-chat,hermes}.md`, `example-prompts.md` — aucun ne doit enseigner un flow que le serveur rejette. Le flow `dry_run:true → false` **reste valide** (conservé) → a priori rien à casser, mais à confirmer.
- Mentionner la carte dans le guide `claude-desktop` (hôte MCP Apps).

### Références

- `docs/mcp-connect/` et `.github/instructions/*` : s'assurer qu'aucune instruction n'affirme que le modèle peut appliquer une carte de vue.

## Out of Scope

- Le code (T291/T292) et l'ADR/glossaire (T290).
- Généraliser la doc aux `create_program` / `create_workout_day`.

## Acceptance Criteria

- [ ] `skills/gymlogic-mcp/SKILL.md` décrit la carte + `apply_program_patch`, et dit explicitement que le modèle ne l'appelle pas.
- [ ] Le SKILL conserve le `dry_run:false` d'`update_program` comme chemin valide pour les hôtes non-MCP-Apps.
- [ ] `docs/mcp-connect/claude-desktop.md` mentionne le rendu de la carte.
- [ ] Aucun doc de `README.md` / `docs/mcp-connect/` n'enseigne un flow rejeté par le serveur (audit écrit, écarts corrigés).
- [ ] Le formatage suit les conventions existantes (pas de nouvelle clé i18n ici).

## References

- Epic [#643](https://github.com/PierreTsia/workout-app/issues/643) · Tech Plan `file:docs/Tech_Plan_—_Agentic_components_show_act_#643.md` (Modified Files)
- `file:skills/gymlogic-mcp/SKILL.md` · `file:docs/mcp-connect/` · T291, T292
