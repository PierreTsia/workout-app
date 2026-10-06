# T300 — Style partagé + Session Card Nomos

## Goal

Extraire un module de style commun aux deux vues MCP et restyler la **Session Card** avec les briques Nomos (`Heading` / `Text` / `Kicker` / `Separator` / `Counter` / `EmptyState`), honorer le thème de l'hôte, et supprimer la barre de tonnage arbitraire. Epic [#651](https://github.com/PierreTsia/workout-app/issues/651), stories 1, 8, 9, 11.

## Mode

AFK — décisions verrouillées ; la QA visuelle réelle se fait en T302.

## Slice

`src/mcp-views/styles.ts` → `session-card/SessionCard.tsx` → `session-card/entry.tsx` → build → arch test.

## Dependencies

None (indépendant du serveur).

## Scope

### Module de style partagé — `file:src/mcp-views/styles.ts` (nouveau)

- Exporter `panel` (largeur/max 520/centrage) et les styles layout aujourd'hui dupliqués dans `SessionCard.tsx:5-13` et `ProgramPatchCard.tsx:9-17`.
- Aucune dépendance : pas de `fetch`, pas d'accès Supabase (contrainte arch test).

### Session Card — `file:src/mcp-views/session-card/SessionCard.tsx`

- Remplacer les styles inline (`fontSize`, `color-mix`) par les composants Nomos : `Heading` (titre jour), `Text` (`size="caption"` pour les métadonnées muted), `Kicker` (eyebrow), `Separator` (à la place des `color-mix`), `Counter` (tonnage, `value` + `label`).
- **Supprimer** la `ProgressBar` de tonnage et son échelle `/10000` (aucun objectif de domaine).
- État vide (`!payload.session`) : utiliser `EmptyState` (`title` + `description`).
- Badge PR **inchangé** (`Badge variant="secondary"`).
- Importer `panel` depuis `styles.ts`.

### Thème — `file:src/mcp-views/session-card/entry.tsx`

- Passer `onHostContext` à `connectAppBridge` (`bridge.ts:82`) pour piloter `data-theme` (`"dark" | "light"`), repli `"dark"`.

### Build & test

- `npm run build:view` puis commit de `file:supabase/functions/mcp/resources/views/sessionCard.generated.ts` ; `npm run view:check` vert.
- `file:src/test/mcpSessionCard.arch.test.ts` : ajouter que le composant embarque `Counter` et **plus** `ProgressBar`.
- `file:src/locales/locales.test.ts` doit rester vert (aucune nouvelle clé pour cette carte).

## Out of Scope

- Toute nouvelle chaîne i18n (la Session Card réemploie l'existant).
- La Program Patch Card (→ T301).
- Le contenu/données de la carte (payload inchangé).

## Acceptance Criteria

- [ ] `src/mcp-views/styles.ts` existe et est importé par la Session Card (plus de `panel` local).
- [ ] La Session Card n'utilise plus de `fontSize`/`color-mix` décoratif en dur (hors layout).
- [ ] Le tonnage est rendu par `Counter`, la `ProgressBar` a disparu.
- [ ] `data-theme` suit `onHostContext().theme` avec repli `dark`.
- [ ] `sessionCard.generated.ts` rebuild et committé ; `npm run view:check` vert.
- [ ] Arch test Session Card vert (assertion `Counter` / absence `ProgressBar`).

## References

- Epic Brief `file:docs/Epic_Brief_—_Refinement_design_des_cartes_MCP.md` · issue [#651](https://github.com/PierreTsia/workout-app/issues/651)
- Tech Plan `file:docs/Tech_Plan_—_Refinement_design_des_cartes_MCP.md` (Component Architecture)
- `file:src/mcp-views/session-card/`, `file:src/mcp-views/bridge.ts:82`, `file:scripts/build-mcp-view.mjs`, `file:src/test/mcpSessionCard.arch.test.ts`
