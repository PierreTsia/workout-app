# Epic Brief — Skin GL nommé, partagé app et vues MCP (#683)

## Summary

GymLogic a une identité visuelle (le teal `174 100% 39%`) qui vit aujourd'hui **par accident** dans deux couches distinctes : le `@theme` legacy vendoré de `file:src/styles/globals.css` peint l'app, tandis que les tokens **par défaut** du cœur Nomos portent déjà cette même identité — et les vues MCP s'en servent. App et vue ne s'accordent donc que par **coïncidence de valeurs**. Cet epic introduit un **skin GL nommé** (`glSkin`), un overlay sémantique DTCG, dont **dérivent** l'app CSS **et** les vues MCP via la seule surface publique Nomos (`resolveSkin` + `renderCss`). Il retire dans la foulée le `@theme` legacy et migre les derniers usages directs de ses variables. Pour l'athlète : aucun changement visible attendu, mais la garantie « app et cartes identiques par construction » devient **vraie** — et le restera le jour où Nomos neutralise son défaut. Pour l'équipe : une seule source de vérité pour les couleurs, rayons et typographie, tenue par un artefact committé et un check de non-dérive.

---

## Context & Problem

**Who is affected :** l'athlète qui voit la **Session Card** / **Decision Card** dans son agent (External MCP Client) et attend qu'elles ressemblent à l'app ; l'équipe (mainteneur Nomos/GL) qui doit pouvoir garantir cette parité sans la re-prouver à chaque retouche.

**Current state:**
- `file:src/styles/globals.css` définit un `@theme` vendored (`--color-primary: hsl(var(--primary))`, `--color-teal`…) plus des blocs `:root` / `.dark` / `.light` portant les valeurs HSL legacy (`--primary: 174 100% 39%`, etc.).
- `@nomosui/react/tokens/theme.css` (déjà importé) réalise **le même raccord Tailwind** mais depuis `--nomos-color-*`, dont les valeurs par défaut sont **identiques** aux valeurs legacy.
- `file:scripts/build-mcp-view.mjs` inline `tokens.generated.css` (le défaut du cœur) pour styler les vues, sans skin.
- ~7 fichiers consomment encore directement les variables legacy (`hsl(var(--primary))`, `hsl(var(--muted))`, `hsl(var(--border))`) : `file:src/components/RestTimerDrawer.tsx`, `file:src/components/workout/CountdownRing.tsx`, `file:src/components/body-map/bodyMapColors.ts`, `file:src/components/body-map/BodyMap.tsx`, `file:src/components/history/ExerciseChart.tsx`, `file:src/components/workout/ExerciseHistoryTrendChart.tsx`.
- La rampe `--heatmap-0..6` (`file:src/components/history/TrainingHeatmap.tsx`) est **spécifique GL** et n'a pas d'équivalent sémantique Nomos.

**Pain points:**
| Pain | Impact |
|---|---|
| Pas de skin nommé | La claim ADR 0027 « identique à l'app par construction » est **dégradée** à « même défaut du cœur » — une coïncidence, pas une garantie |
| Deux couches couleur dans l'app | Dette : toute retouche visuelle touche potentiellement deux endroits, dérive silencieuse |
| Défaut du cœur malléable | Le jour où Nomos neutralise son défaut (prévu, ADR 0022), l'app et les vues **changent d'identité ensemble**, sans que GL l'ait décidé |
| Usages directs de variables legacy | Bloquent le retirement du `@theme` sans migration explicite |

---

## User Stories

1. As an `athlete`, I want `the Session Card and Decision Card to share the app's exact colours, radii and type scale`, so that `the agentic surface never looks like a different product`.
2. As an `athlete`, I want `the app and the cards to keep their current look through this refactor`, so that `I see no visual regression — same teal, same dark surfaces, same contrast`.
3. As an `athlete` `on a light-themed host`, I want `the cards to keep following my host theme after the skin change`, so that `light mode still renders correctly`.
4. As an `athlete`, I want `the history heatmap to keep its distinct 7-stop teal ramp`, so that `the activity view stays legible (the ramp is not a generic tint)`.
5. As a `maintainer`, I want `one named glSkin to be the single source for both app CSS and view CSS`, so that `I change GL's identity once and both renders follow`.
6. As a `maintainer`, I want `the app CSS derived from the skin to be a committed artifact with a CI check`, so that `a drifted or forgotten rebuild fails the build instead of silently shipping`.
7. As a `maintainer`, I want `the legacy @theme and its HSL variables removed`, so that `the app no longer has two colour layers and the ADR 0027 §6 follow-up is closed`.
8. As a `maintainer`, I want `the remaining direct hsl(var(--primary|muted|border)) usages migrated to Nomos tokens`, so that `removing the legacy @theme breaks nothing`.
9. As a `maintainer`, I want `an architecture test that the app and view derives from the same resolved skin`, so that `the parity is proven, not assumed`.
10. As a `maintainer`, I want `the GL skin to own its values explicitly (not inherit the heart's default)`, so that `a future Nomos default change cannot silently repaint GymLogic`.
11. As a `future GL contributor`, I want `the skin file to be a DTCG overlay whose unknown slots fail loudly at build`, so that `a typo in a colour slot is caught, not ignored`.
12. As an `agent/External MCP Client`, I want `the rendered view document to stay self-sufficient (inlined CSS + markup + bundle)`, so that `no host-side skin resolution is required`.
13. As a `maintainer`, I want `the view build (view:check) and skin check to be independent`, so that `a view markup change and a skin change are diagnosed separately`.
14. As an `athlete` `whose app runs in light mode (`.light` class)`, I want `the mode mechanism to keep working via Nomos tokens (`.dark`/`.light`/`[data-theme]`)`, so that `the existing theme toggle is untouched`.

### Success measures

| Story # | Measure |
|---|---|
| 1, 9 | An arch test resolves the app CSS and the view CSS and asserts both come from `resolveSkin(default, glSkin)` (same source), not from two literals |
| 2 | Visual audit: app dark + light before/after are pixel-equivalent on the affected surfaces (no regression) |
| 5, 6 | `npm run glSkin:check` and `npm run view:check` both green in CI after a fresh build with no uncommitted diff |
| 7, 8 | `grep` finds no remaining `@theme` block for colour slots in `globals.css`, and no `hsl(var(--primary|muted|border))` outside the GL heatmap/guard blocks |
| 10 | `glSkin` pins GL values explicitly; removing the heart default values in a test fixture does not change the resolved GL palette |

---

## Scope

**In scope :**

1. **`glSkin`** — un overlay sémantique DTCG (couleurs, rayons, typographie) portant explicitement l'identité GL actuelle (teal primary, surfaces sombres, rampes de statut, rayons). Fichier possédé par GL, consommé via `resolveSkin(defaultTokens, glSkin)`. Les slots inconnus échouent au build (contrat ADR 0022).
2. **Dérivation app CSS** — un script `file:scripts/build-gl-skin.mjs` produit un CSS committé (`renderCss(resolveSkin(default, glSkin))`), importé par `file:src/styles/globals.css` **à la place** de `@nomosui/react/tokens/tokens.generated.css`. Guard CI `glSkin:check` (même régime que `view:check`).
3. **Retirement du `@theme` legacy** — suppression du bloc `@theme` de `globals.css` (le raccord Tailwind vient désormais de `theme.css`), et suppression des valeurs HSL legacy `:root/.dark/.light` couvertes par Nomos.
4. **Migration des usages directs** — les ~7 fichiers qui lisent `hsl(var(--primary|muted|border))` passent aux variables Nomos (`hsl(var(--nomos-color-primary|muted|border))`) ou à un token/utility équivalent.
5. **Bloc GL conservé** — la rampe `--heatmap-*` (et tout ce qui n'est pas un slot sémantique Nomos : animations d'achievement, guard d'orientation) reste dans un bloc **GL-owned** de `globals.css`, explicitement hors skin.
6. **Build des vues aligné** — `file:scripts/build-mcp-view.mjs` inline le CSS dérivé du skin (celui de l'étape 2) au lieu de `tokens.generated.css`, puis replay + commit des `*.generated.ts`.
7. **Tests d'architecture** — un test prouve que app CSS et view CSS partagent la source résolue ; `view:check` et arch tests existants restent verts.
8. **ADR** — `file:docs/adr/0027-agentic-view-contract.md` §6 passe de « dégradé » à « tenu », et `CONTEXT.md` gagne le terme **Skin GL** (`glSkin`).

**Out of scope :**
- Tout changement fonctionnel ou de contenu des cartes (ADR 0027 hors périmètre du brief #651 rappelé).
- Toute nouvelle carte/composite.
- La migration visuelle des composants au-delà de la couche couleur/rayon/typo (pas de re-skin des écrans).
- La neutralisation du défaut du cœur côté Nomos (amont, hors dépôt).
- Une seconde app / un second skin Nomos.
- L'auto-apply hors carte (#287), Jev (#552), toute écriture.

---

## Success Criteria

- **Numeric :** `npm test` (dont le nouvel arch test de parité de source), `npm run lint`, `npm run glSkin:check` et `npm run view:check` verts ; zéro `@theme` couleur legacy résiduel ; zéro `hsl(var(--primary|muted|border))` hors blocs GL identifiés.
- **Qualitative :** app (dark + light) et les deux cartes MCP dérivent **du même** skin par construction ; audit visuel sans régression ; le terme **Skin GL** est au glossaire et l'ADR 0027 §6 est passé à « tenu ».

---

## Références

- Issue [#683](https://github.com/PierreTsia/workout-app/issues/683) · Epic [#643](https://github.com/PierreTsia/workout-app/issues/643) · [#591](https://github.com/PierreTsia/workout-app/issues/591)
- ADR `file:docs/adr/0027-agentic-view-contract.md` §6 · Nomos ADR 0022 (skin overlay), ADR 0025 (distribution expose CSS + skin)
- `file:src/styles/globals.css`, `file:scripts/build-mcp-view.mjs`, `file:src/mcp-views/styles.ts`
- Brief voisin : `file:docs/Epic_Brief_—_Refinement_design_des_cartes_MCP.md`
