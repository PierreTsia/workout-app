# T294 — HITL : QA hôte réel + copy pass + closeout

## Goal

Vérifier la carte de décision **dans un vrai hôte MCP Apps** (Claude Desktop **et** mobile), passer la copie au crible, et clôturer l'epic [#643](https://github.com/PierreTsia/workout-app/issues/643) : c'est la preuve que « de show à act » fonctionne en vrai, pas seulement en test.

## Mode

HITL — dépend d'un rendu réel dans Claude (Desktop + mobile), d'un jugement visuel/copie, et d'un parcours manuel d'écriture sous consentement.

## Slice

QA manuelle (hôte réel → rendu → clic → write observé) → revue copie (EN/FR) → closeout epic.

## Dependencies

T292 (carte + pont), T293 (docs). De préférence après déploiement de T291.

## Scope

### QA hôte réel

- Claude Desktop : `update_program{dry_run:true}` → la carte rend l'aperçu réel ; clic **Valider** → l'état passe applied ; vérifier côté données que le programme a bien changé (RLS/user).
- Claude mobile (claude.ai) : même carte, même clic (au moins une fois).
- Hôte non-MCP-Apps (Cursor **ou** Le Chat) : pas de carte, le modèle garde `update_program{dry_run:false}` — non-régression.
- Cas d'échec : token expiré → état **erreur** propre, aucun write.

### Copy pass (HITL)

- Valider les chaînes `mcpView:patch.*` EN/FR avec la skill `microcopy` ; corriger les valeurs si besoin (parité `locales.test.ts`).
- Eyeball : densité, états vide/applied/erreur, lisibilité du `rendered`.

### Closeout

- Archiver les tickets T290–T294 dans `docs/done/` si l'epic est clos (convention dépôt).
- Mettre à jour #643 : cocher les critères de succès, fermer.
- Nommer les suivis : #287 (enforcement hors carte), autres composites, skin GL.

## Out of Scope

- Tout code produit (corrections → tickets dédiés si un défaut est trouvé).
- Les autres composites et le skin.

## Acceptance Criteria

- [ ] Capture/observation du rendu réel dans Claude Desktop **et** mobile.
- [ ] Le clic Valider applique réellement le changement (vérifié dans les données), sans écriture depuis la vue.
- [ ] Un token expiré affiche l'état erreur et n'écrit rien.
- [ ] Un hôte non-MCP-Apps conserve l'édition via `update_program{dry_run:false}`.
- [ ] Chaînes EN + FR validées (ou corrigées) ; `locales.test.ts` vert.
- [ ] #643 clos avec ses critères de succès cochés ; T290–T294 archivés dans `docs/done/`.

## References

- Epic [#643](https://github.com/PierreTsia/workout-app/issues/643) · Tech Plan `file:docs/Tech_Plan_—_Agentic_components_show_act_#643.md` (Failure Mode Analysis)
- T291, T292, T293 · skill `microcopy` · précédent : `file:docs/T288_—_QA_MCP_Apps_Claude_Desktop_+_mobile.md`
