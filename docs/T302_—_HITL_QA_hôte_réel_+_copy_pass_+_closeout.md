# T302 — HITL : QA hôte réel + copy pass + closeout

## Goal

Prouver que la carte programme « de show à act » se rend **proprement dans un vrai hôte MCP Apps** (Claude Desktop et mobile), valider la copie EN/FR, et clôturer l'epic [#651](https://github.com/PierreTsia/workout-app/issues/651). Story 10 (non-régression hors MCP Apps) + critères de succès de l'epic.

## Mode

HITL — dépend d'un rendu réel dans Claude, d'un jugement visuel/copie, et d'un parcours manuel d'écriture sous consentement.

## Slice

QA manuelle (hôte réel → rendu → clic → write observé) → revue copie (EN/FR) → closeout epic.

## Dependencies

T301. De préférence après rebuild et `view:check` verts.

## Scope

### QA hôte réel

- Claude Desktop : `update_program{dry_run:true}` → la carte rend le programme **structuré** (jours, lignes d'exercice, champs changés, chips, alertes) ; clic **Appliquer** → état applied ; vérifier côté données que le programme a changé (RLS/user).
- Claude mobile (claude.ai) : même carte, même clic (au moins une fois).
- Thème : vérifier le rendu en clair **et** sombre (la carte suit l'hôte).
- Locale : vérifier FR **et** EN (prescriptions localisées).
- Hôte non-MCP-Apps (Cursor **ou** Le Chat) : pas de carte, le modèle garde `update_program{dry_run:false}` — **non-régression**.
- Cas d'échec : token expiré → état **erreur** propre, aucun write.

### Copy pass (HITL)

- Valider les chaînes `mcpView.*` EN/FR avec la skill `microcopy` ; corriger si besoin (parité `locales.test.ts`).
- Eyeball : densité, états preview/applied/erreur, lisibilité de la prescription et des annotations `changed*`.

### Closeout

- Archiver T298–T302 dans `docs/done/` (convention dépôt).
- Mettre à jour #651 : cocher les décisions/critères, fermer.
- Nommer les suivis éventuels (nouvelle carte lecture seule, skin GL).

## Out of Scope

- Tout code produit (corrections → tickets dédiés si un défaut est trouvé).
- Les autres composites et le skin GL.

## Acceptance Criteria

- [ ] Capture/observation du rendu structuré dans Claude Desktop **et** mobile.
- [ ] Le clic Appliquer applique réellement le changement (vérifié dans les données), sans écriture depuis la vue.
- [ ] Rendu vérifié thème clair **et** sombre.
- [ ] Prescriptions vérifiées FR **et** EN.
- [ ] Un token expiré affiche l'état erreur et n'écrit rien.
- [ ] Un hôte non-MCP-Apps conserve l'édition via `update_program{dry_run:false}`.
- [ ] Chaînes EN + FR validées (ou corrigées) ; `locales.test.ts` vert.
- [ ] #651 clos avec ses critères ; T298–T302 archivés dans `docs/done/`.

## References

- Epic Brief `file:docs/Epic_Brief_—_Refinement_design_des_cartes_MCP.md` · issue [#651](https://github.com/PierreTsia/workout-app/issues/651)
- Tech Plan `file:docs/Tech_Plan_—_Refinement_design_des_cartes_MCP.md`
- T298–T301 · skill `microcopy` · précédent : `file:docs/T294_—_HITL_QA_hôte_réel_+_copy_pass_+_closeout.md`
