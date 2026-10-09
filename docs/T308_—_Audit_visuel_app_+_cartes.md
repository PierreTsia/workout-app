# T308 — Audit visuel app + cartes

## Goal

Vérifier de visu, avec l'artefact en main, qu'aucune régression visuelle n'est introduite par le skin GL et le retirement du `@theme` legacy : app en dark **et** light, plus les deux cartes MCP dans un hôte réel. Couvre les stories 2 et 3.

## Mode

HITL — jugement visuel humain, non automatisable ; nécessite de rendre les cartes dans un hôte MCP Apps (Claude Desktop/mobile).

## Slice

`audit manuel (app dark/light + cartes dans l'hôte)`

## Dependencies

T306 (le legacy est retiré).

## Scope

### Surfaces à comparer (avant/après)

| Surface | Mode | Points d'attention |
|---|---|---|
| App — Home, Profil, séance, history, builder | dark | surfaces, teal, bordures, contrastes (muted-foreground), rayons |
| App — mêmes écrans | light | bascule de thème, surfaces claires, heatmap light |
| FeedbackSheet | dark/light | animation `success-flash` toujours jouée |
| Accordéon (`components/ui/accordion.tsx`) | dark/light | `animate-accordion-*` toujours jouées |
| Session Card (`ui://gymlogic/session-card`) | dark + light | suit le thème de l'hôte |
| Decision Card (`ui://gymlogic/program-patch`) | dark + light | idem |

### Méthode

- Comparer les captures à la prod actuelle (`https://www.gymlogic.me`) sur les mêmes écrans/modes.
- Rendre les deux cartes dans Claude Desktop (et mobile si possible) en dark puis light.
- Consigner le verdict (OK / régression) ; toute régression devient une issue `type:fix` liée à #683.

## Out of Scope

- Corriger les régressions ici (tickets `fix` séparés).
- Modifier le contenu/design des cartes.

## Acceptance Criteria

- [ ] App dark et light : aucune régression perceptible sur les écrans listés.
- [ ] Animations `success-flash` et `accordion-*` jouent toujours.
- [ ] Les deux cartes suivent le thème de l'hôte (dark et light observés).
- [ ] Verdict consigné ; régressions éventuelles ouvertes en issues `fix`.

## References

- Epic Brief `file:docs/Epic_Brief_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (stories 2, 3 ; success criteria « audit visuel »)
- Tech Plan `file:docs/Tech_Plan_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (§ Failure Mode Analysis)
