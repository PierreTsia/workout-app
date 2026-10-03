# T271 — Slice admin feedback sur FacetedDataTable

## Goal

Reconstruire `/admin/feedback` sur `FacetedDataTable` du cœur : table + toolbar locales remplacées, filtre de statut porté en `FacetDef`, détail de ligne via `RowDetail` du cœur (ou fallback `placement:'inline'`), et `StatusDropdown` via `Select`. Mapper les libellés `admin:feedback.*` dans `labels`.

## Mode

`AFK`.

## Slice

`i18n feedback → statusFacet → FeedbackDetailRow + StatusDropdown → AdminFeedbackPage (FacetedDataTable) → vitest + @qa`

## Dependencies

- T268 (fondation).

## Scope

### Composants

- `file:src/components/admin/feedback-table/DataTable.tsx` → `FacetedDataTable` dans `file:src/pages/AdminFeedbackPage.tsx`.
- `file:src/components/admin/feedback-table/DataTableToolbar.tsx` → `DataTableToolbar` du cœur.
- **Adapter** `file:src/components/admin/feedback-table/columns.tsx` et `features.ts` aux types cœur (conserver `tableMeta` adminEmail si nécessaire).
- Détail de ligne : `file:src/components/admin/feedback-table/FeedbackDetailRow.tsx` via `RowDetail` (`placement:'inline'`) ; vérifier la parité avec l'expand actuel, sinon fallback local documenté.
- `file:src/components/admin/feedback-table/StatusDropdown.tsx` → `Select` du cœur.

### Seam app-side (nouveau fichier)

| File | Purpose |
|---|---|
| `src/components/admin/feedback-table/facets.ts` | `statusFacet(t)` → `FacetDef` (`all`/`pending`/`in_review`/`resolved`) |

### i18n

- `admin:feedback.searchPlaceholder`, `allStatus`/`pending`/`inReview`/`resolved`, `totalCount`, `pendingCount`, `noResults`, `columns.*`, `actions.*`, `detail.*` injectés dans `labels` via `buildDataTableLabels` (T269).

### Pagination

- **Vérifier** : feedback n'avait pas de pagination. Activer la pagination du cœur uniquement si le volume le justifie ; sinon la désactiver pour préserver le comportement actuel.

## Out of Scope

- Table exercises (T269), formulaire (T270), coquilles (T272).

## Acceptance Criteria

- [ ] `/admin/feedback` rend `FacetedDataTable` ; `feedback-table/DataTable.tsx` et `DataTableToolbar.tsx` supprimés.
- [ ] Le filtre de statut fonctionne via `FacetDef` ; la recherche par nom d'exercice est préservée.
- [ ] Le détail de ligne s'ouvre comme avant (`RowDetail` inline ou fallback documenté).
- [ ] `StatusDropdown` utilise `Select` du cœur et les transitions de statut (in_review/resolved/reopen) fonctionnent.
- [ ] État vide (`No feedback reports`) rendu via `labels.empty` / `EmptyState`.
- [ ] Test composant de la table feedback vert ; `npm test` + `npm run lint` passent.
- [ ] EN + FR cohérents (contrat i18n ou complété via `microcopy`).
- [ ] Passe @qa post-migration sur `/admin/feedback` (light/dark/mobile).

## References

- Tech Plan : § Component Architecture, § Failure Mode Analysis (`RowDetail` vs `rowExpanding`), § Stress-Test (pagination feedback).
- Epic : GitHub #583. Ticket lié : T268 (dep).
