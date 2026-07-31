# Epic Brief — Localized Exercise Catalog (#415)

## Summary

Rendre le **contenu du catalogue** (noms d'exercices, groupes musculaires, équipement) lisible dans la langue de l'utilisateur, alors qu'aujourd'hui seul le chrome est traduit et que tout le contenu reste français. Le principe est fixé par l'**ADR 0010** : on résout les libellés **à l'affichage**, depuis la ligne `exercises` jointe, et jamais en localisant ce qui s'écrit dans un **Catalog Snapshot**. Aucun des six chemins d'écriture n'est modifié. La donnée anglaise voyage déjà dans le même payload que les lignes de séance (`file:src/lib/exerciseSelects.ts`, `file:src/hooks/useWorkoutExercises.ts`), donc l'opération coûte zéro requête supplémentaire, conserve la parité offline à l'identique, et **corrige rétroactivement les programmes et l'historique existants** sans migration ni réécriture. L'epic est coupé en deux : la **v1 couvre l'affichage**, la **v1.5 couvre le classement des RPC de recherche et la lecture de locale côté MCP**, conditionnée à une mesure préalable. Les instructions (#417) sont un chantier de génération de contenu et font l'objet d'un epic distinct.

---

## Context & Problem

**Who is affected:** Les utilisateurs anglophones, arrivés majoritairement par **MCP** (Claude, Cursor, Grok) où l'agent résout les exercices en anglais et écrit des labels de jour anglais. Signalé de l'extérieur par un contributeur sur [#415](https://github.com/PierreTsia/workout-app/issues/415) et [#417](https://github.com/PierreTsia/workout-app/issues/417), captures d'écran à l'appui.

**Current state:**
- Le catalogue est **déjà bilingue pour les noms** : `exercises.name` (FR) + `exercises.name_en`, rempli sur les 598 lignes. L'import Wger était anglophone et le FR est la traduction assistée par IA — l'anglais est la donnée d'origine, pas un dérivé. Le PRD documente pourtant `name_en` comme *« English name for search »* : il n'a jamais été pensé comme nom d'affichage.
- `name_en` est **déjà transporté** par `SLIM_EXERCISE_SELECT` et `FULL_EXERCISE_SELECT`, et `useWorkoutExercises` embarque la ligne catalogue complète dans la même requête PostgREST que les lignes de séance. La donnée est sur le fil, simplement jamais lue.
- L'affichage lit exclusivement le **Catalog Snapshot**, écrit depuis `exercises.name` par **six** chemins distincts — aucun n'est conscient de la locale.
- Dans l'historique, `exercise_name_snapshot` n'est **pas un libellé** : c'est la clé de regroupement des séries solo, la `key` React, et le critère de tri (`file:src/lib/sessionHistoryGrouping.ts`). Localiser l'affichage sans toucher au reste produirait un tri alphabétique français sur des libellés anglais.
- `muscle_snapshot` stocke du **français brut** (`"Pectoraux"`), taxonomie canonique typée de 13 valeurs (`MUSCLE_TAXONOMY` dans `file:src/lib/trainingBalance.ts`) dont dépend le mapping SVG du BodyMap (`file:src/lib/muscleMapping.ts`). Traduit **uniquement** dans l'onglet Balance de l'historique, via `balance.muscles` (`file:src/locales/en/history.json`), avec un `defaultValue: key` qui retombe **silencieusement** sur le français.
- `equipment` stocke des slugs anglais, traduits dans les pills de filtre du builder (`equipment.*` dans `file:src/locales/en/builder.json`) mais affichés bruts sur `file:src/pages/library/ExerciseLibraryExercisePage.tsx`.
- La **Display Locale** est un état d'appareil : `localeAtom` en `localStorage` (`file:src/store/atoms.ts`), même pattern que `weightUnitAtom`. `user_profiles` n'a aucune colonne de langue, et l'auth MCP (`file:supabase/functions/mcp/lib/auth.ts`) ne lit jamais le profil.
- `search_exercises` et `resolve_exercises_batch` ont **deux biais de langue** : la priorité de match place le français avant l'anglais, et le tiebreak final trie alphabétiquement sur `e.name`.
- Les trois emails transactionnels sont en **anglais en dur** (`file:supabase/functions/send-transactional-email/welcome.ts`, `.../feedback.ts`) : les utilisateurs français reçoivent déjà des mails anglais. C'est la seule surface où la locale ne peut pas venir de la requête (déclenchement par webhook Postgres).

**Pain points:**
| Pain | Impact |
|---|---|
| Nom d'exercice FR imposé | Un anglophone voit « Développé couché » dans un programme dont le nom et les jours sont en anglais |
| Muscle FR imposé partout sauf Balance | Corriger seulement les noms produit « Bench Press · Pectoraux » — le mixte persiste |
| Fallback de traduction silencieux | Une clé muscle manquante rend du français sans aucun signal ; invisible pour un relecteur francophone |
| Nom snapshoté porteur de logique | L'historique regroupe et trie sur le nom, donc localiser l'affichage seul casse l'ordre |
| Classement de recherche biaisé FR | Un anglophone obtient ses résultats dans l'ordre alphabétique français |
| Langue non persistée | Un nouvel appareil devine la langue via `navigator` au lieu de suivre le compte, et elle est **non backfillable** une fois perdue |
| Catalog Snapshot FR gelé | Toute correction à l'écriture laisserait les programmes et l'historique existants inchangés à jamais |

---

## User Stories

1. As an **English-speaking user**, I want program and session rows to show the **English exercise name** when my **Display Locale** is EN, so that a program built in English reads entirely in English.
2. As an **English-speaking user**, I want **muscle group labels in English on every surface** (session badge, builder rows, library, filter pills — not only the History balance tab), so that I don't get "Bench Press · Pectoraux".
3. As an **English-speaking user**, I want **equipment labels translated on the library detail page**, so that I read "Barbell" instead of the raw `barbell` slug.
4. As a **French-speaking user**, I want **nothing to change** in what I see, so that localizing for others is not a regression for the default audience — with **one documented exception**, story 6.
5. As a user with **programs created before this shipped**, I want their names and muscles to display in my language **without re-saving anything**, so that the fix is retroactive.
6. As a user browsing **past sessions**, I want logged exercise names in my language, and I accept that history now groups by **exercise identity** rather than by snapshotted name — which also fixes a latent bug where a catalog rename split one exercise into two cards.
7. As a user of an exercise whose **`name_en` is null or blank**, I want the French name shown rather than a blank, so that the fallback is invisible.
8. As a user whose **catalog row is unavailable** (absent from the query payload — deletion is impossible while rows reference it), I want the **Catalog Snapshot** used as last resort, so that history never loses its label.
9. As a user **running a session offline**, I want localized labels with no network, so that localization costs me nothing in the gym basement.
10. As a user who **switches language mid-session**, I want labels to update without a reload and **without losing logged sets or the active timer**, so that the switch is safe at any moment.
11. As a user signing in on a **new device**, I want my account's language applied instead of a guess from `navigator`, so that I don't land on a French UI I never chose.
12. As a **new user**, I want my detected language persisted to my profile at onboarding, so that it is captured while it still exists client-side.
13. As an **MCP consumer** (Claude, Cursor), I want `get_program_details` and `get_upcoming_workouts` to return **both names** — `**Développé couché** (Bench Press)` — exactly as `search_exercises` and `resolve_exercises` already do, so that the agent can address the user in either language without a second lookup.
14. As an **admin creating a catalog exercise** with a French name only, I want it displayed as typed in both locales, so that unfinished catalog rows degrade gracefully.
15. As a **maintainer**, I want the resolution rule implemented **once in the web app** and consumed by every display surface, so that it cannot drift the way the six **Catalog Snapshot** write paths already have.
16. As a **maintainer**, I want a **missing muscle translation to fail CI** rather than silently render French, so that an incomplete epic is impossible to ship unnoticed.
17. *(v1.5)* As an **English-speaking user searching the library**, I want results **ranked and tiebroken in my language**, so that the ordering doesn't look random.
18. *(v1.5)* As an **MCP agent resolving an English query**, I want the top hit to be the right exercise, so that `create_program` doesn't persist the wrong one.

### Success measures
| Story # | Measure |
|---|---|
| 4 | **0 changement de libellé** pour `locale = fr`, hors l'exception documentée de la story 6 — test de non-régression sur les surfaces d'affichage |
| 5, 6 | **100 %** des programmes et sessions déjà en base s'affichent dans la langue choisie, **sans écriture** en base |
| 9 | **0 requête réseau supplémentaire** sur le chemin séance par rapport à aujourd'hui |
| 7, 8 | Chaîne de fallback `name_en → name → Catalog Snapshot` couverte par test, y compris `name_en` vide et ligne catalogue absente |
| 16 | Test d'exhaustivité sur les **13** valeurs de `MUSCLE_TAXONOMY` dans `en` **et** `fr` |
| 18 | Le taux de mauvaise résolution des requêtes EN est **mesuré** par un script d'audit **avant** que la v1.5 ne soit construite |

---

## Scope

**In scope (v1 — affichage):**
- **Colonne de locale** sur `user_profiles` (à côté de `timezone`), écrite à l'onboarding et à chaque changement. Précédence figée par **Display Locale** : `localStorage` gagne toujours au rendu, le profil ne fait qu'amorcer un appareil sans valeur locale. Le boot reste synchrone.
- **Helper de résolution unique, côté web**, appliquant `name_en → name → Catalog Snapshot`, consommé par toutes les surfaces d'affichage.
- **Noms d'exercices** localisés sur les surfaces programme, séance, bibliothèque et historique.
- **Groupes musculaires** localisés partout, en généralisant `balance.muscles`. **Décision tranchée par le Tech Plan** : la représentation stockée reste le **français canonique**, la traduction se fait à l'affichage, zéro migration. La bascule vers des slugs anglais est une dette réelle mais dont le coût est back-end (RPC `get_volume_by_muscle_group`, `TAXONOMY_TO_SLUGS`, alias MCP, scripts d'import, fixtures) et sans rapport avec l'objectif de cet epic — elle est tracée en [#423](https://github.com/PierreTsia/workout-app/issues/423). Contrainte dure dans les deux cas : `file:src/lib/muscleMapping.ts` et `file:src/lib/trainingBalance.ts` sont indexés sur les chaînes françaises.
- **Équipement** : appliquer les clés `equipment.*` existantes aux surfaces qui affichent encore le slug brut.
- **Historique** : `groupSessionHistory` regroupe et trie sur `exercise_id` ; les requêtes d'historique gagnent l'embed catalogue nécessaire à la résolution.
- **Test d'exhaustivité** sur `MUSCLE_TAXONOMY` dans les deux locales.
- **MCP lecture seule** : `get_program_details` et `get_upcoming_workouts` renvoient les deux noms — aucune locale requise, donc aucun changement d'auth.
- **Réconciliation des défauts** contradictoires : `localeAtom` (`"fr"`) contre `i18n.fallbackLng` (`"en"`).

**In scope (v1.5 — conditionnée à la mesure):**
- **Script d'audit one-shot** sous `scripts/`, même pattern que `audit-muscle-tags.ts`, mesurant si des requêtes anglaises résolvent vers le mauvais exercice.
- Si l'audit le justifie : **paramètre de locale** dans `search_exercises` et `resolve_exercises_batch`, et **lecture de `user_profiles.locale` dans l'auth MCP** — nouvelle surface pour un chemin aujourd'hui strictement auth + exécution d'outils, à documenter dans son propre ADR à ce moment-là.

**Out of scope:**
- **Instructions localisées** → epic dédié sur [#417](https://github.com/PierreTsia/workout-app/issues/417) : colonne à ajouter, génération LLM de 598 × 4 tableaux sur du contenu de forme technique, relecture manuelle d'un sous-ensemble à fort trafic.
- **Emails transactionnels localisés** → issue séparée. Localiser trois templates HTML exigerait un second sous-système i18n côté Deno (`react-i18next` est web-only) ; disproportionné ici, mais la colonne de locale est capturée dès la v1 précisément parce qu'une préférence client-only n'est **jamais** backfillable.
- **Localisation à l'écriture** du **Catalog Snapshot** → rejetée par l'**ADR 0010** (voir [#416](https://github.com/PierreTsia/workout-app/pull/416)).
- **Migration des snapshots existants** → rendue inutile par la résolution à l'affichage.
- **Copy des coachs et prompts IA** → déjà pilotés par la locale passée par requête aux Edge Functions.
- **Persistance offline durable** (IndexedDB, React Query persist) → non requise ici, mais reste la vraie limite offline du produit.
- **Toute langue autre que EN et FR.**

---

## Success Criteria

- **Qualitatif :** un anglophone qui crée un programme via MCP puis l'ouvre dans l'app lit « Bench Press · Chest · Barbell » de bout en bout — nom du programme, label du jour, nom d'exercice, muscle, équipement — sans une seule chaîne française.
- **Rétroactif :** ses programmes et son historique **antérieurs** à l'epic s'affichent immédiatement dans sa langue, sans réécriture, sans migration, sans backfill.
- **Non-régression :** en `locale = fr`, chaque surface rend les mêmes chaînes qu'avant l'epic, à la seule exception documentée du regroupement d'historique.
- **Numérique :** aucune requête réseau supplémentaire sur le chemin séance ; parité offline conservée à l'identique.
- **Échec bruyant :** une traduction musculaire manquante fait échouer la CI ; il est impossible de livrer une localisation partielle sans le voir.
- **Anti-dérive :** une seule implémentation de la règle de résolution — le mode d'échec des six chemins de snapshot divergents n'est pas reproduit.
- **Décision informée :** la v1.5 n'est engagée qu'après mesure, pas sur une inquiétude théorique.

---

## References

- ADR : `file:docs/adr/0010-localize-catalog-at-display-time.md`
- Glossaire (**Catalog Snapshot**, **Display Locale**) : `file:docs/CONTEXT.md`
- Issues : [#415](https://github.com/PierreTsia/workout-app/issues/415) (noms), [#417](https://github.com/PierreTsia/workout-app/issues/417) (instructions, epic séparé) ; PR rejetée avec analyse : [#416](https://github.com/PierreTsia/workout-app/pull/416)
- Adjacent : [#298](https://github.com/PierreTsia/workout-app/issues/298) (i18n mini-site), [#364](https://github.com/PierreTsia/workout-app/issues/364) (crash auto-traduction Chrome), [#286](https://github.com/PierreTsia/workout-app/issues/286) (alias de recherche FR)
- Données déjà bilingues : `file:src/lib/exerciseSelects.ts`, `file:supabase/migrations/20240101000007_add_exercise_library_columns.sql`
- Surfaces d'affichage : `file:src/components/workout/ExerciseDetail.tsx`, `file:src/components/workout/ExerciseStrip.tsx`, `file:src/components/builder/ExerciseRow.tsx`, `file:src/pages/library/ExerciseLibraryExercisePage.tsx`, `file:src/lib/sessionHistoryGrouping.ts`
- Précédents à généraliser : `file:src/locales/en/history.json` (`balance.muscles`), `file:src/locales/en/builder.json` (`equipment.*`)
- Précédent de préférence persistée : `user_profiles.timezone`
- Contraintes à ne pas casser : `file:src/lib/muscleMapping.ts`, `file:src/lib/trainingBalance.ts`
- RPC concernées (v1.5) : `file:supabase/migrations/20260326120000_search_exercises.sql`, `file:supabase/migrations/20260506000736_resolve_exercises_batch.sql`
- Pattern d'audit à reprendre : `file:scripts/audit-muscle-tags.ts`
