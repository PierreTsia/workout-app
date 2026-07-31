# T147 — `catalogLabels` lib + `useCatalogLabels` hook

## Goal

Le cœur de l'epic : une **lib pure** qui résout un libellé d'exercice, de muscle ou d'équipement pour une locale donnée, et un **hook mince** qui la lie à la locale courante. Mirror exact du pattern `blockCompletionHistory.ts` + `useBlockCompletionHistory` (#396) — logique testable hors rendu, ergonomie au call site.

Aucune surface n'est câblée dans ce ticket : il livre l'outil et sa preuve.

## Mode

**AFK** — la chaîne de fallback est figée par l'ADR.

## Slice

`lib/catalogLabels.ts` (pur, testé FR + EN) → `useCatalogLabels()`

## Dependencies

T145 (tests bilingues), T146 (tables `catalog:*`).

## Scope

### `src/lib/catalogLabels.ts` — pur

- `resolveExerciseName(source, locale)` appliquant **`name_en` → `name` → `name_snapshot`** :
  - `name_en` n'est retenu que si `locale === "en"` **et** que la valeur trimée est non vide.
  - En `fr`, retourne toujours `name` (jamais `name_en`), puis le snapshot si la ligne catalogue est absente.
- Signature laxiste sur l'entrée (`{ exercise?: … | null; name_snapshot?: string; exercise_name_snapshot?: string }`) pour servir indifféremment une ligne `workout_exercises` embarquée et un `set_log` enrichi.
- `muscleLabelKey(value)` et `equipmentLabelKey(slug)` → clé i18n, ou `null` si la valeur est hors taxonomie.
- **Aucune** dépendance React / i18next : la locale est un paramètre.

### `src/hooks/useCatalogLabels.ts`

- Lit `i18n.language` et `t` du namespace `catalog`, retourne `{ exerciseName, muscleLabel, equipmentLabel }` bornés à la locale courante, mémoïsés sur `[language]`.
- `muscleLabel(value)` : traduit si la clé existe, **retombe sur la valeur brute** sinon — la base contient des valeurs hors taxonomie (`"Ischios / Bas du dos"`, `"Deltoïdes post."`) que `mapMuscleToSlugs` ignore déjà.
- Ne déclenche aucune requête.

### Tests

- `catalogLabels.test.ts` : `name_en` présent / `""` / `"   "` / `null` / ligne catalogue absente ; `locale: "fr"` retourne toujours `name` ; muscle hors taxonomie → valeur brute ; slug d'équipement inconnu → slug brut.
- Un test de hook (`renderHookWithProviders`, `locale: "fr"` et `"en"`) prouvant que le même input rend deux libellés différents.

## Out of Scope

- Câbler quoi que ce soit (T149, T150, T151).
- Les embeds de requêtes (T148).

## Acceptance Criteria

- [ ] `resolveExerciseName` couvre toute la chaîne de fallback, trim compris, testée dans les deux locales.
- [ ] `catalogLabels.ts` n'importe ni React ni i18next.
- [ ] `useCatalogLabels` rend le nom anglais en `en` et le nom français en `fr` pour la même ligne.
- [ ] Une valeur de muscle hors taxonomie s'affiche brute, sans throw ni clé nue à l'écran.
- [ ] Aucune requête réseau ajoutée par le hook.

## References

- Epic Brief : stories 7, 8 (fallbacks), 14 (exercice catalogue FR-only), 15 (règle implémentée une seule fois)
- ADR : `file:docs/adr/0010-localize-catalog-at-display-time.md`
- Tech Plan : § Key Decisions (forme du helper, chaîne de fallback), § Component Responsibilities
- Pattern : `file:src/lib/blockCompletionHistory.ts`, `file:src/hooks/useBlockCompletionHistory.ts`
