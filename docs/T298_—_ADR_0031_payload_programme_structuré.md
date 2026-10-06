# T298 — ADR 0031 : payload programme structuré + locale

## Goal

Figer, avant tout code, le changement **additif** du contrat public `update_program` : sa réponse `dry_run` porte désormais un `program` structuré (jours + exercices typés + annotations de changement) et une `locale`, à côté du `rendered` markdown conservé. Epic [#651](https://github.com/PierreTsia/workout-app/issues/651), stories 2, 3, 5, 12.

## Mode

AFK — décision déjà tranchée au grilling #651, aucun jugement humain attendu.

## Slice

ADR (docs) uniquement.

## Dependencies

None.

## Scope

### Fichier

`file:docs/adr/0031-decision-card-structured-program.md` — même format que les ADR 0027 / 0028 voisins.

### Contenu imposé

- **Contexte** : la Decision Card (`ui://gymlogic/program-patch`, ADR 0028) ne reçoit que `rendered` (markdown EN-only) ; elle ne peut pas rendre une vraie carte programme.
- **Décision** :
  - `update_program` `dry_run:true` ajoute, **uniquement** dans `structuredContent` (hors contexte modèle, comme `preview_token`) : `locale: "en" | "fr"` et `program: { name, days[] }` (exercices typés, `change: ("sets"|"reps"|"weight"|"rest")[] | null`, `isNew`).
  - La `locale` est résolue par priorité : argument optionnel `locale` de l'outil → `user_profiles.locale` → `"en"` (`resolveCardLocale`, miroir de `render_session_card`).
  - Le `payload` modèle-visible et `rendered` **ne changent pas** : le changement est additif.
- **Alternatives rejetées** : parser le markdown `rendered` côté vue (duplique un format EN-only) ; remplacer `rendered` (casserait les clients non-MCP-Apps).
- **Conséquences** : contrat public étendu ⇒ tests d'arch + test Deno ; la carte retombe sur `rendered` si `program` absent.
- **Références** : ADR `0027` / `0028`, `docs/Tech_Plan_—_Refinement_design_des_cartes_MCP.md`.

### CONTEXT.md

Si l'ADR introduit un terme nouveau (ex. « payload programme structuré »), l'ajouter au glossaire `file:docs/CONTEXT.md` dans la foulée ; sinon ne rien changer.

## Out of Scope

- Tout code (→ T299).
- Toute modification de `rendered`, `payload`, des outils `create_program` / `get_program_details`.

## Acceptance Criteria

- [ ] `docs/adr/0031-decision-card-structured-program.md` existe et suit le format ADR du dépôt.
- [ ] L'ADR nomme explicitement l'additivité (rien retiré de `structuredContent`, `payload`/`rendered` intacts).
- [ ] L'ADR documente la précédence de locale.
- [ ] L'ADR liste les alternatives rejetées et référence 0027/0028 + le Tech Plan.
- [ ] Aucun fichier de code touché.

## References

- Epic Brief `file:docs/Epic_Brief_—_Refinement_design_des_cartes_MCP.md`
- Tech Plan `file:docs/Tech_Plan_—_Refinement_design_des_cartes_MCP.md` (Key Decisions, Data Model)
- ADR `file:docs/adr/0027-agentic-view-contract.md`, `file:docs/adr/0028-view-intention-and-consent-token.md`
