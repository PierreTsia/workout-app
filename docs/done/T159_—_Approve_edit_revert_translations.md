# T159 — Approve / edit / revert translations

## Goal

Rendre la file décidable : approuver une traduction, corriger une coquille, ou la rendre au français — au clavier, avec la décision horodatée pour qu'une seconde passe ne représente jamais ce qui a déjà été tranché.

Le point de vigilance est une colonne : cette mutation **ne doit pas toucher `reviewed_at`**. Ce champ est partagé entre la revue de contenu de `AdminReviewPage` et l'upload d'images de l'enrichissement ; l'écrire ici sortirait l'exercice de la file de revue de contenu sans que personne ne l'ait relu.

Couvre les stories 7 et 10 de l'Epic Brief.

## Mode

**AFK** — la sémantique des trois actions et la colonne d'horodatage sont fixées.

## Slice

`useApproveTranslation` → actions de la carte + raccourcis clavier → écriture RLS → vitest

## Dependencies

T158.

## Scope

### Mutation

`src/hooks/useApproveTranslation.ts`, sur le patron de `file:src/hooks/useAdminUpdateExercise.ts` — client anon avec la session de l'admin, pas de service role. La policy `"Admins can update exercises"` couvre déjà l'UPDATE depuis le navigateur, aucun changement de RLS n'est nécessaire.

Le hook existant **stampe systématiquement `reviewed_at` et `reviewed_by`** : c'est pourquoi il ne peut pas être réutilisé, et pourquoi celui-ci écrit sa propre liste de colonnes.

| Action | Écrit |
|---|---|
| Approuver | `instructions_en_status = 'approved'`, `instructions_en_reviewed_at = now()` |
| Approuver après édition | idem, plus `instructions_en` corrigé |
| Rendre au français | `instructions_en_status = 'flagged'`, `instructions_en_reviewed_at = now()` |

Rendre au français **conserve** le contenu anglais : la ligne quitte la file et réaffiche le français, mais la traduction reste en base pour qu'une future passe puisse la reprendre avec `--force`.

Invalidation des mêmes clés que `useAdminUpdateExercise` — la ligne catalogue est en cache à plusieurs endroits — plus la clé de la file. Toast via `sonner`, comme partout ailleurs dans l'admin.

### Actions et clavier

Trois affordances sur `TranslationReviewCard`, plus le saut. Raccourcis en handlers **locaux** `onKeyDown` sur le conteneur, comme `file:src/components/builder/BuilderHeader.tsx` : le repo n'a aucun hook de raccourci global, et ce ticket n'en invente pas.

| Touche | Action |
|---|---|
| `A` | Approuver |
| `E` | Basculer en édition |
| `R` | Rendre au français |
| `→` | Passer sans décider |

L'édition est **minimale et volontairement inconfortable** : un `Textarea` brut par section, une ligne par phrase. La correction structurée, la validation de forme et le diff sont le sujet de T160 ; les mettre ici viderait T160 de sa raison d'être et ferait doubler ce ticket.

La file est reconstruite après chaque écriture, l'index local repart sur l'élément suivant — comme `AdminReviewPage` le fait déjà après sauvegarde.

### Tests

- Approuver écrit `approved` et l'horodatage, et **laisse `reviewed_at` nul** — assertion explicite sur la charge de l'UPDATE.
- Rendre au français écrit `flagged` et l'horodatage, et conserve `instructions_en`.
- Une ligne décidée quitte la file au rechargement.
- Les quatre raccourcis déclenchent la bonne action.
- Erreur d'écriture : toast d'erreur, la ligne reste dans la file.

## Out of Scope

- L'assistant presse-papier, la validation de JSON collé et le diff : T160.
- Toute écriture sur `reviewed_at` ou `reviewed_by`.
- Une reprise de position persistée entre deux sessions : l'index reste local, comme dans l'écran de revue existant.
- Toute action de masse. La relecture est phrase à phrase, par construction.

## Acceptance Criteria

- [ ] Approuver écrit `instructions_en_status` et `instructions_en_reviewed_at`, et **ne mentionne pas** `reviewed_at` dans la charge.
- [ ] La file de revue de contenu de `/admin/review` rend le même nombre d'éléments avant et après une approbation de traduction.
- [ ] Rendre au français repasse la ligne en `flagged`, conserve `instructions_en`, et l'app en anglais réaffiche le français.
- [ ] Une ligne décidée ne réapparaît plus dans la file.
- [ ] Les quatre raccourcis fonctionnent et n'interceptent pas la frappe dans un `Textarea` en édition.
- [ ] Une erreur d'écriture laisse la ligne en place avec un toast d'erreur.
- [ ] **Démo** : trois lignes tranchées d'affilée au clavier, la file se vide, et l'affichage de l'app suit chaque décision.

## References

- Epic Brief : `docs/Epic_Brief_—_English_Exercise_Instructions_#417.md`, stories 7, 10
- Tech Plan : `docs/Tech_Plan_—_English_Exercise_Instructions_#417.md`, § Critical Constraints (deux chemins d'écriture), § Component Responsibilities
- Issue [#417](https://github.com/PierreTsia/workout-app/issues/417)
- Précédents : `file:src/hooks/useAdminUpdateExercise.ts`, `file:src/components/builder/BuilderHeader.tsx`
