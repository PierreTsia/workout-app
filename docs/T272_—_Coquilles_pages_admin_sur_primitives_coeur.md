# T272 — Coquilles des pages admin sur les primitives cœur

## Goal

Migrer les coquilles et éléments de page dupliqués des pages admin restantes (`home`, `review`, `translations`, `enrichment`, et la coquille `edit`) vers les primitives cœur : `EmptyState`, `ProgressBar`, `Skeleton`, `Card`, `Button`, `Badge`. Supprimer les markups dupliqués (spinner, page header, empty state, progress bar) au profit des atomes partagés.

## Mode

`AFK`.

## Slice

`EmptyState/ProgressBar/Skeleton/Card/Button/Badge (cœur) → 5 pages → vitest`

## Dependencies

- T268 (fondation).
- T270 (la coquille `/admin/review` embarque le formulaire migré).

## Scope

### Pages

| Page | Change |
|---|---|
| `file:src/pages/AdminHomePage.tsx` | `Button` du cœur ; bloc Sentry test → `Card` |
| `file:src/pages/AdminReviewPage.tsx` | Spinner → `Skeleton` ; empty state → `EmptyState` ; barre de progression → `ProgressBar` ; `Button`/`Badge` cœur |
| `file:src/pages/AdminTranslationsPage.tsx` | Spinner → `Skeleton` ; empty state → `EmptyState` ; `ProgressBar` ; `Button`/`Badge` |
| `file:src/pages/AdminEnrichmentPage.tsx` | Spinner → `Skeleton` ; empty state → `EmptyState` ; `ProgressBar` ; `Button`/`Badge` |
| `file:src/pages/AdminExerciseEditPage.tsx` | Spinner → `Skeleton` ; `Button`/`Badge` cœur (coquille seule) |

### Duplications supprimées

- Spinner `h-8 w-8 animate-spin …` (`AdminExercisesPage.tsx:20`, `AdminExerciseEditPage.tsx:36`, `AdminFeedbackPage.tsx:20`) et variantes `Loader2`.
- Page header `h1.text-2xl.font-bold` + `p.text-sm.text-muted-foreground` répété.
- Empty state `PartyPopper` + titre/hint + bouton retour.
- Barre de progression `h-2 … bg-muted` + fill `bg-primary`.

### i18n

- Réutiliser `admin:review.*`, `admin:translations.*`, `admin:enrichment.*`, `admin:homeDescription`, `admin:sentryTest.*`. Nouvelles clés éventuelles → `microcopy`.

## Out of Scope

- Tables (T269, T271).
- Formulaire (T270).
- `AdminFeedbackPage` (traité en T271).

## Acceptance Criteria

- [ ] Les 5 pages n'utilisent plus de spinner/empty-state/progress/header maison ; elles passent par `Skeleton`/`EmptyState`/`ProgressBar`/`Card`/`Button`/`Badge` du cœur.
- [ ] Aucune balise `<h1 className="text-2xl font-bold">` ni barre de progression dupliquée ne subsiste dans ces pages.
- [ ] Les empty states des files review/translations/enrichment s'affichent identiquement (mêmes libellés/actions).
- [ ] `npm test` + `npm run lint` passent ; les tests existants (`AdminTranslationsPage.test.tsx`) restent verts.
- [ ] EN + FR cohérents (contrat ou `microcopy`).
- [ ] Passe @qa sur les 5 pages (light/dark/mobile) sans régression visuelle.

## References

- Tech Plan : § New Files & Modified files, § Failure Mode Analysis.
- Epic : GitHub #583. Tickets liés : T268, T270 (deps).
