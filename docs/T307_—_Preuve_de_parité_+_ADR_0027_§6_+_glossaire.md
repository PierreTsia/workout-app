# T307 — Preuve de parité + ADR 0027 §6 + glossaire

## Goal

Apporter la **preuve mécanique** que l'app CSS et le CSS des vues dérivent du même skin, clore le follow-up ADR 0027 §6 (dégradé → tenu) et inscrire le terme **Skin GL** au glossaire. Couvre les stories 9 et 7 (volet documentation).

## Mode

AFK — test d'architecture + mises à jour de docs déjà décidées.

## Slice

`arch test de parité → docs/adr/0027 §6 → docs/CONTEXT.md`

## Dependencies

T304 (vues branchées) et T306 (legacy retiré).

## Scope

### Arch test `src/test/glSkin.arch.test.ts` (compléter T303/T305)

- **Parité de source** : `scripts/build-gl-skin.mjs` dérive via `resolveSkin`+`renderCss` sur `glSkin.json` ; `scripts/build-mcp-view.mjs` inline `glSkin.generated.css` ; **aucun** des deux ne référence `tokens.generated.css` du paquet.
- **Pas de legacy** : `globals.css` ne contient aucun `--color-*` (mapping) ni variable HSL couleur legacy.
- **Pin GL** : `glSkin.generated.css` porte `--nomos-color-primary: 174 100% 39%`.
- **CI** : `package.json` porte `glSkin:check` ; `ci.yml` l'exécute avant `view:check`.

### `docs/adr/0027-agentic-view-contract.md`

- §6 passe de « Skin: ride the heart's default tokens for v1, claim degraded » à « tenu » : un skin GL nommé (`glSkin`) est consommé par l'app CSS **et** le view CSS via `resolveSkin(default, glSkin)`.
- Mettre à jour le paragraphe `Consequences` (le « Negative : two colour layers » est résolu) et le bloc `Follow-ups` (retirer le skin GL de la liste).

### `docs/CONTEXT.md`

- Ajouter le terme **Skin GL** (`glSkin`) : « L'overlay DTCG d'identité GymLogic, fusionné par `resolveSkin` sur le défaut du cœur ; source unique du CSS app et du CSS des vues MCP (ADR 0027 §6). » avec ancre `file:src/styles/glSkin.json`.

## Out of Scope

- Audit visuel (T308).
- Toute modification de comportement.

## Acceptance Criteria

- [ ] L'arch test échoue si `build-mcp-view.mjs` repointe vers `tokens.generated.css` (test par mutation).
- [ ] ADR 0027 §6 lit « tenu » ; `Consequences` et `Follow-ups` cohérents.
- [ ] `CONTEXT.md` porte **Skin GL** avec ancre de fichier.
- [ ] `npm test` vert.

## References

- Epic Brief `file:docs/Epic_Brief_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md` (stories 9, 7)
- Tech Plan `file:docs/Tech_Plan_—_Skin_GL_nommé_partagé_app_et_vues_MCP.md`
- ADR `file:docs/adr/0027-agentic-view-contract.md` §6 · Nomos ADR 0022
