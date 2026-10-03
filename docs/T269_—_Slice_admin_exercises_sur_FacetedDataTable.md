# T269 — Slice admin exercises sur FacetedDataTable

## Goal

Reconstruire `/admin/exercises` sur `FacetedDataTable` du cœur Nomos : remplacer la table locale (DataTable + Toolbar + Pagination + segmented review) par les atomes partagés, mapper les libellés i18n `admin` dans la prop `labels`, porter la recherche bilingue et le filtre de review dans les seams app-side (`globalFilterFn` + `FacetDef`), et corriger le débordement mobile relevé par @qa. Premier livrable démontrable de l'epic #583.

## Mode

`AFK` — décisions de composition déjà tranchées par le Tech Plan.

## Slice

`i18n admin → buildDataTableLabels + reviewStatusFacet + exerciseGlobalFilterFn → AdminExercisesPage (FacetedDataTable) → vitest (DataTable.test.tsx) + passe @qa`

## Dependencies

- T268 (fondation : tokens + primitives cœur disponibles).

## Scope

### Composant

- Remplacer `file:src/components/admin/exercises-table/DataTable.tsx` par `FacetedDataTable` (non contrôlée) dans `file:src/pages/AdminExercisesPage.tsx`.
- Colonnes : **adapter** `file:src/components/admin/exercises-table/columns.tsx` aux types du cœur (ne pas réécrire from scratch) ; conserver la traduction des cellules muscle/équipement et la recherche sur label traduit + valeur canonique.
- Pagination : `DataTablePagination` du cœur (`pageSize 50`, `Page 1 of 2` conservé) ; libellés depuis `admin:pagination.*`.
- Toolbar : `DataTableToolbar` du cœur (recherche + facets) en remplacement du segmented maison.

### Seams app-side (nouveaux fichiers)

| File | Purpose |
|---|---|
| `src/components/admin/tableLabels.ts` | `buildDataTableLabels(t)` : mappe `admin:*` → `DataTableLabels` du cœur |
| `src/components/admin/exercises-table/facets.ts` | `reviewStatusFacet(t)` → `FacetDef` (`all`/`notReviewed`/`reviewed`) + `exerciseGlobalFilterFn` (recherche bilingue) |

### i18n

- Mapper les clés `admin` existantes vers `labels` (`searchPlaceholder`, `pagination.*`, `allReviewStatus`/`reviewed`/`notReviewed`).
- **Auditer** les champs requis par `DataTableLabels` du cœur (`search`, `reset`, `clear`, `empty`, `unit`, `shown`, `rows`, `pageOf`, `previous`, `next`). Toute clé manquante dans `file:src/locales/en/admin.json` / `fr/admin.json` est ajoutée **via le skill `microcopy`** (EN+FR) — ne pas inventer de wording.

### Responsive

- Corriger le débordement horizontal de la table en 390px (relevé @qa), p.ex. contenu de cellule tronqué / colonnes secondaires masquées selon le pattern cœur.

### Suppression

- `exercises-table/DataTable.tsx`, `DataTableToolbar.tsx`, `DataTablePagination.tsx`.
- `features.ts` : remplacé par les features du cœur si compatibles, sinon adapté.

## Out of Scope

- Formulaire d'édition (T270).
- Autres pages admin (T271, T272).
- Feedback table.

## Acceptance Criteria

- [ ] `/admin/exercises` rend `FacetedDataTable` du cœur ; les 3 fichiers locaux `DataTable/DataTableToolbar/DataTablePagination` sont supprimés.
- [ ] Le filtre de review (all/not reviewed/reviewed) fonctionne via `FacetDef` ; la recherche bilingue (label traduit + valeur canonique) via `globalFilterFn`.
- [ ] La pagination `pageSize 50` affiche `Page 1 of 2`.
- [ ] La table ne débord plus en 390px.
- [ ] `DataTable.test.tsx` est adapté et vert (traduction de cellule, nom stocké conservé, recherche bilingue).
- [ ] Les clés EN + FR correspondent au contrat i18n du Tech Plan (ou complétées via `microcopy`).
- [ ] `npm test` + `npm run lint` passent ; passe @qa post-migration sur `/admin/exercises` (light/dark/mobile) comparée à la baseline.

## References

- Tech Plan : § Component Architecture (vertical slice), § i18n contract.
- Epic : GitHub #583. Tickets liés : T268 (dep), T273 (retirement).
