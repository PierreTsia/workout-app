# T288 — QA MCP Apps dans Claude Desktop + mobile

## Goal

Vérifier **dans un vrai hôte** que la Session Card se rend réellement : Claude **Desktop** d'abord (validé), puis **mobile** (claude.ai) dans le même epic. Couvre les stories 1, 2, 5, 6, 8 de l'Epic Brief.

## Mode

**HITL** — le rendu réel dans un hôte externe (compte Claude, iframe sandboxée, support mobile non confirmé) se juge à la main ; les captures sont la preuve.

## Slice

Passe manuelle dans Claude Desktop puis claude.ai mobile : cartes **pleine**, **vide**, **FR/EN** ; repli texte sur un client non-MCP-Apps ; contrôle qu'aucune écriture ne se produit.

## Dependencies

**T285** (données réelles) et **T286** (locale) — la QA porte sur la chaîne complète.

## Scope

- Desktop : déclencher `render_session_card` (« montre ma dernière séance »), vérifier le rendu de la carte (pleine + vide), FR et EN ; capturer.
- Mobile (claude.ai) : même vérification ; si MCP Apps n'est pas rendu, **documenter le non-support avec preuve** (l'Epic accepte « Desktop validé, mobile suivi »).
- Contrôle lecture seule : aucune écriture observée côté compte.
- Client non-MCP-Apps (ex. Cursor / Le Chat) : le résumé texte s'affiche, le client ne casse pas.
- Consigner les trouvailles (captures) ; ouvrir un ticket par défaut observé.

## Out of Scope

- Correction des défauts trouvés (tickets séparés).
- Toute modification de code.

## Acceptance Criteria

- [ ] Desktop : carte **pleine** rendue, capture à l'appui.
- [ ] Desktop : **état vide** rendu, capture à l'appui.
- [ ] Desktop : rendu **FR** et **EN** corrects (noms + libellés).
- [ ] Mobile : rendu vérifié **ou** non-support documenté avec preuve.
- [ ] Client non-MCP-Apps : repli texte affiché, aucun crash.
- [ ] Aucune écriture observée ; lecture seule confirmée.
- [ ] Trouvailles consignées (captures) ; défauts transformés en tickets.

## References

- Epic Brief `file:docs/Epic_Brief_—_Surface_agentique_Nomos_#591.md` (stories 1, 2, 5, 6, 8)
- Tech Plan `file:docs/Tech_Plan_—_Surface_agentique_Nomos_#591.md` (§ Failure Mode Analysis)
- ADR `file:docs/adr/0027-agentic-view-contract.md`
- MCP Apps client matrix : https://modelcontextprotocol.io/extensions/client-matrix
