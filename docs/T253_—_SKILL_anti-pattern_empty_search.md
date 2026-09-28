# T253 — SKILL.md : paragraphe anti-pattern « recherche vide »

## Goal

Graver dans le SKILL canonique l'anti-pattern exact de l'incident #288 : après une `search_exercises` (ou `resolve_exercises`) vide, un agent doit abandonner l'option ou demander à l'utilisateur — jamais fabriquer un placeholder id.

## Dependencies

- Tech Plan `file:docs/Tech_Plan_—_MCP_UUID_Guard_#288.md`
- Wording validé dans l'Epic Brief (story 3).

## Scope

### skills/gymlogic-mcp/SKILL.md

| Item | Detail |
|---|---|
| Edge cases | Nouvelle ligne : `search_exercises` / `resolve_exercises` returns no usable result → abandon the option and ask the user; NEVER fabricate a placeholder id or any non-UUID string (worked example: `kroc-row-id`) |
| Règle | Compléter la règle générique « Never invent or transcribe from memory » (ligne ~630) d'un renvoi explicite au cas « empty search » |
| Exemple | Montrer le mauvais pattern (fabrication après `search_exercises("Kroc row")` vide) et le bon (abandon / ask) |

Aucun autre wording inventé au-delà du contrat de l'Epic Brief.

## Out of Scope

- Miroir dans `AGENTS.md` d'Iris (chemin (3) de l'issue — prochain refresh agent).
- Fuzzy matching FR de `search_exercises` (#286).

## Acceptance Criteria

- [ ] L'entrée edge-case « empty search → never fabricate » est présente avec l'exemple du mauvais pattern
- [ ] La règle ligne ~630 renvoie explicitement au cas empty-search
- [ ] Aucun autre changement de contrat dans SKILL.md (diff limité à ces ajouts)

## References

- Issue #288, Epic Brief #288, Tech Plan #288, incident HITL Epic C #280 prompt 3
