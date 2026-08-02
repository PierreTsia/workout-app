# T158 — Translation review queue

## Goal

Livrer la surface qui rend la relecture possible : une file priorisée et une comparaison français / anglais alignée phrase à phrase, avec les objections du contre-relecteur accrochées à la phrase visée. **En lecture seule** — séparer la lecture de l'écriture rend ce ticket utile seul, puisque c'est la surface qui permet de regarder le taux de signalement réel avant d'avoir construit le chemin d'écriture.

La file va sur une **route sœur `/admin/translations`**, pas dans un onglet : chaque outil admin de ce repo est une route, et `/admin/enrichment` a déjà été sorti ainsi pour exactement le même patron de file à une carte.

Couvre les stories 5 et 6 de l'Epic Brief.

## Mode

**AFK** — l'ordre de la file, la projection du RPC et la forme de la carte sont fixés par le Tech Plan.

## Slice

RPC → `useTranslationReviewQueue` → route `/admin/translations` → `TranslationReviewCard` → i18n → vitest

## Dependencies

T156 (les colonnes et le type `TranslationAudit`). T157 fournit le contenu réel, mais n'est pas bloquant : une ligne semée à la main suffit à démontrer ce ticket. Les deux peuvent donc être pris en parallèle.

## Scope

### RPC

`get_translations_for_review()`, `SECURITY DEFINER`, **projection étroite à huit colonnes** : `id`, `name`, `name_en`, `instructions`, `instructions_en`, `instructions_en_status`, `instructions_en_audit`, `logged_sets`.

Délibérément différent de `get_unreviewed_exercises_by_usage` (`file:supabase/migrations/20260414000000_create_review_rpc.sql`) sur deux points. Il énumère 18 colonnes à la main et pourrit à chaque ajout au schéma ; celui-ci ne demande que ce que la file rend. Et il compte l'usage sur `workout_exercises` + `template_exercises`, c'est-à-dire les **prescriptions** ; celui-ci compte les lignes de `set_logs`, c'est-à-dire l'**exposition réelle en lecture**.

Filtre : `instructions_en IS NOT NULL AND instructions_en_reviewed_at IS NULL`. Ordre : les `flagged` d'abord, puis séries loguées décroissantes, puis nom.

### Hook et route

`src/hooks/useTranslationReviewQueue.ts` appelle le RPC. Route `/admin/translations` ajoutée sous `AdminGuard` dans `file:src/router/index.tsx`, à côté des cinq routes admin existantes, avec son entrée depuis `AdminHomePage`.

`src/pages/admin/AdminTranslationsPage.tsx` reprend la coquille de `file:src/pages/AdminReviewPage.tsx` : en-tête, barre de progression, une carte à la fois, index local dans la file. Pas de pagination — le volume attendu est de quelques centaines de lignes.

### Carte de comparaison

`src/components/admin/translations/TranslationReviewCard.tsx` — les quatre sections l'une sous l'autre, français et anglais côte à côte, alignés **par index dans la section**. Chaque objection de `instructions_en_audit` se rend en badge sur la phrase qu'elle visait, avec son verdict et sa note.

Un badge de statut, et le nombre de séries loguées, pour que le relecteur sache ce qu'il arbitre.

### i18n

Nouvelles clés sous `admin.translations.*` dans **les deux** `file:src/locales/en/admin.json` et `file:src/locales/fr/admin.json`. `EnrichmentCard` et ses chaînes anglaises en dur sont le contre-exemple du repo : ne pas le copier.

### Tests

- Ordre de la file : un `flagged` peu logué passe avant un `clean` très logué.
- Une objection s'affiche sur la bonne phrase, pas en tête de section.
- État vide quand la file est épuisée.
- Un non-admin est redirigé (couvert par `AdminGuard`, à vérifier une fois).

## Out of Scope

- Toute écriture : approuver, éditer et rendre au français sont dans T159.
- L'assistant presse-papier : T160.
- Toute modification de `get_unreviewed_exercises_by_usage` ou de la file de revue de contenu existante. Les deux files doivent rester **étanches** : c'est précisément parce que `reviewed_at` est partagé entre revue de contenu et enrichissement d'images que ce ticket s'appuie sur une colonne dédiée.

## Acceptance Criteria

- [ ] `get_translations_for_review` renvoie huit colonnes et compte les séries loguées, pas les prescriptions.
- [ ] Les `flagged` remontent avant les `clean`, et les `clean` sont triés par séries loguées décroissantes.
- [ ] Une objection de l'audit s'affiche sur la phrase anglaise qu'elle visait.
- [ ] Les libellés existent en anglais **et** en français, aucun texte en dur.
- [ ] `/admin/translations` est inaccessible à un non-admin.
- [ ] `get_unreviewed_exercises_by_usage` est inchangé et sa file rend le même nombre d'éléments qu'avant.
- [ ] **Démo** : avec deux lignes semées à la main, une `flagged` et une `clean`, la file les présente dans le bon ordre et la comparaison est lisible phrase à phrase.

## References

- Epic Brief : `docs/Epic_Brief_—_English_Exercise_Instructions_#417.md`, stories 5, 6
- Tech Plan : `docs/Tech_Plan_—_English_Exercise_Instructions_#417.md`, § Data Model (RPC), § Component Architecture
- Issue [#417](https://github.com/PierreTsia/workout-app/issues/417)
- Précédents : `file:src/pages/AdminReviewPage.tsx`, `file:src/router/index.tsx`, `file:src/router/AdminGuard.tsx`
