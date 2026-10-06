# Epic Brief — Refinement design des cartes MCP

## Summary

Les cartes MCP GymLogic (« tranche 1 » : **Session Card** et **Decision Card**) fonctionnent mais ne ressemblent pas au produit : styles inline en dur, échelle typographique Nomos ignorée, Decision Card qui déverse du markdown dans un `<pre>` monospace. Cet epic les aligne sur le langage visuel Nomos — composants sémantiques, tons, thème de l'hôte honoré, prescriptions localisées — et fait exposer par `update_program` les jours/exercices **structurés** pour que la Decision Card rende une vraie carte programme (maquette Stitch validée) au lieu d'un bloc monospace. Le contrat MCP est étendu de façon **additive** (`rendered` reste), avec marqueurs de changement par exercice. Pour l'athlète, la proposition de l'agent devient lisible et jugeable dans la conversation ; pour l'équipe, les deux cartes cessent de dériver.

---

## Context & Problem

**Who is affected :** l'athlète qui parle à son agent (**External MCP Client** : Claude Desktop / mobile) et voit ces cartes rendues dans la conversation — la carte est la surface produit de l'agent, pas un détail cosmétique.

**Current state :**
- `file:src/mcp-views/session-card/SessionCard.tsx` et `file:src/mcp-views/program-patch/ProgramPatchCard.tsx` partagent des styles inline dupliqués à l'identique (`panel`, `muted`), des `fontSize` / `color-mix` en dur, et forcent `data-theme="dark"`.
- `file:src/mcp-views/program-patch/ProgramPatchCard.tsx:79-94` rend `payload.rendered` (markdown, **EN-only**) dans un `<pre>`.
- La locale de la Decision Card vient de `navigator.language` (`entry.tsx`) ; celle de la Session Card vient de `payload.locale` — incohérent.
- `file:src/mcp-views/bridge.ts:82` expose déjà `onHostContext({ theme })` : personne ne l'écoute.
- Le HTML des vues est **auto-suffisant** (`scripts/build-mcp-view.mjs` inline les tokens Nomos + `view.css` + markup SSR + bundle IIFE) : aucune contrainte de sandbox à lever.

**Pain points :**
| Pain | Impact |
|---|---|
| `<pre>` markdown = « wildly unstyled » | la proposition de patch est illisible, l'athlète n'évalue pas avant d'approuver |
| Prescriptions EN-only (`reps`, `rest`) | carte FR affichée avec du vocabulaire anglais |
| Styles inline hors échelle Nomos | dérive, duplication, dette à chaque retouche |
| Thème hôte ignoré (`data-theme="dark"` forcé) | carte sombre collée dans une conversation claire |
| Locale incohérente entre les deux cartes | comportement imprévisible selon la carte |

---

## User Stories

1. As an `athlete`, I want `my last session rendered with the app's typographic scale and tones`, so that `the Session Card feels native to GymLogic`.
2. As an `athlete`, when `the agent proposes a program change`, I want `to see the resulting program structured (days, exercises, prescriptions)`, so that `I can judge it before approving`.
3. As an `athlete`, I want `each exercise line to show what changed (e.g. "Séries 2-3 modifiées")`, so that `I understand the patch at a glance, not just the end state`.
4. As an `athlete`, I want `to see which days are removed / added as distinct chips`, so that `the shape of the change is obvious`.
5. As an `athlete`, I want `warnings (active cycle, slot detachment) shown as a distinct alert`, so that `I don't miss a consequence`.
6. As an `athlete`, I want `the exercise prescription written in my language ("4 × 10 reps · 40 kg · repos 90 s")`, so that `the card matches the app locale`.
7. As an `athlete`, I want `the Apply / applying / applied / error states to be clear`, so that `I know no write happens until I click`.
8. As an `athlete` `on a light-themed host`, I want `the card to follow the host theme`, so that `it doesn't look like a dark sticker`.
9. As an `athlete` `whose card has no data (no session / no sets)`, I want `a proper empty state`, so that `I see an intentional message, not a blank box`.
10. As an `athlete` `on a non-MCP-Apps host (Cursor, Le Chat)`, I want `no regression`, so that `the model still edits via update_program{dry_run:false}`.
11. As a `maintainer`, I want `the two cards to share one style module`, so that `they don't drift apart again`.
12. As a `maintainer`, I want `the structuredContent change to be additive (keep rendered)`, so that `existing consumers and contract tests don't break`.

### Success measures

| Story # | Measure |
|---|---|
| 2, 3, 4, 6 | The Decision Card renders a real structured program (days + exercise lines + change notes) in FR **and** EN in a real MCP Apps host |
| 8 | The card follows the host theme (light and dark observed) |
| 12 | Existing `file:src/test/mcpProgramPatch.arch.test.ts` and `file:src/test/mcpSessionCard.arch.test.ts` stay green **without edits** |

---

## Scope

**In scope :**

1. **Serveur (axe B)** — `update_program` `dry_run` expose dans son `structuredContent`, en plus de `rendered` :
   - `locale` (`en` | `fr`) ;
   - `days[]` = **tous les jours finaux** (modifiés + ajoutés + inchangés), chacun avec `exercises[]` typés (nom, prescription : séries / reps / poids / repos) ;
   - par exercice, une **annotation de changement** au **grain exercice** (ce qui a bougé : sets / reps / poids / repos), composée côté vue — la copie (`Séries 2-3 modifiées`) est locale, le payload ne porte que la donnée typée.
   - Changement **additif** : `rendered`, `removed_days`, `added_days`, `warnings`, `preview_token` conservés. **Contrat MCP public ⇒ ADR + test d'arch.**
2. **Decision Card** — rendu structuré : `Kicker` → `Heading` (nom du programme) → badge statut → `Chip tone="destructive"` (retraits) / `Chip tone="success"` (ajouts) → `Alert tone="warning"` (warnings) → liste jour → ligne exercice (nom en gras, prescription en caption muted `·`, note de changement) → bouton Apply.
3. **Session Card** — passage des styles inline aux briques Nomos (`Heading` / `Text` / `Kicker` / `Separator` / `Counter` / `EmptyState`…) ; tonnage en `Counter` **seul** (barre `/10000` supprimée — aucun objectif de domaine, une barre mentirait) ; badge PR **inchangé** (validé en tranche 1).
4. **Thème de l'hôte** — brancher `onHostContext({ theme })` dans les deux cartes (`data-theme` piloté par l'hôte, repli `dark`).
5. **Locale cohérente** — même source pour les deux cartes : `payload.locale` fourni par le serveur.
6. **Style partagé** — extraire un module commun (`file:src/mcp-views/styles.ts`) : `panel`, layout, tokens partagés ; fin de la duplication.
7. **Copie (i18n)** — pass `microcopy` EN+FR pour les nouvelles chaînes (badge statut, encart de consentement, unités `séries` / `reps` / `repos`), parité `locales.test.ts`.
8. **Build & tests** — `npm run build:view`, commit des `*.generated.ts`, `view:check` vert, arch tests verts.

**Out of scope :**
- Toute **nouvelle** carte programme lecture seule (`get_program_details` / `list_programs` / `create_program`) — nouvel outil + ADR ⇒ autre epic (T292 l'a mise hors scope).
- Migration Nomos au-delà de ces deux cartes ; skin GL nommé (ADR 0027 §6).
- Barre / objectif de tonnage (inventé).
- Nouvel outil MCP, changement de comportement du modèle (`update_program` reste propose-only pour lui).
- L'écriture depuis la vue (jamais — ADR 0027/0028).

---

## Success Criteria

- **Numeric :** zéro `fontSize` / `color-mix` décoratif en dur dans `src/mcp-views/**` hors layout ; `npm test` et `view:check` verts ; les tests de contrat existants passent **sans modification** (additivité prouvée).
- **Qualitative :** les deux cartes se lisent comme des composants GymLogic (maquette Stitch validée) dans Claude Desktop **et** mobile ; la Decision Card affiche un vrai programme structuré, prescriptions loca­lisées, changements annotés, en FR comme en EN ; le thème de l'hôte est respecté.

---

## Décisions verrouillées (grilling #651)

| # | Décision | Choix |
|---|---|---|
| 1 | Source des données | **Axe B** — `structuredContent` structuré (additif, `rendered` conservé) |
| 2 | Ligne exercice | Nom en gras, prescription en caption muted sur 2ᵉ ligne, séparateur `·` |
| 3 | i18n | Prescription reconstruite côté vue depuis les champs typés, pas depuis le markdown |
| 4 | Tons | `Chip tone="destructive"/"success"` (retraits/ajouts), `Alert tone="warning"` ; badge PR inchangé |
| 5 | Tonnage | `Counter` seul, barre `/10000` supprimée |
| 6 | Thème | Honorer `onHostContext().theme` (repli `dark`) |
| 7 | Périmètre | Decision Card + Session Card **uniquement** |

**Compléments (ce brief) :** annotations de changement au **grain exercice** (copie composée côté vue) ; affichage de **tous les jours finaux** ; locale depuis **`payload.locale`**.

## Références

- Issue [#651](https://github.com/PierreTsia/workout-app/issues/651) (état des lieux + grilling verrouillé) · Epic [#643](https://github.com/PierreTsia/workout-app/issues/643) · [#591](https://github.com/PierreTsia/workout-app/issues/591)
- ADR `file:docs/adr/0027-agentic-view-contract.md`, `file:docs/adr/0028-view-intention-and-consent-token.md`
- `file:scripts/build-mcp-view.mjs`, `file:src/mcp-views/**`, `file:supabase/functions/mcp/lib/format.ts:603`
- Maquette Stitch : projet `GymLogic — cartes MCP`
