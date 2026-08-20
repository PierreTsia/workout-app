# T146 — `catalog` i18n namespace

## Goal

Créer un namespace `catalog` portant les libellés de **taxonomie métier** — muscles et équipement — et y déplacer les deux tables qui vivent aujourd'hui au mauvais endroit : `history:balance.muscles` (13 clés, history-scoped par accident, alors que les mêmes libellés sont nécessaires dans le builder, la bibliothèque et la session) et `builder:equipment` (10 clés).

Ajoute surtout un **test d'exhaustivité** qui fait échouer la CI quand une valeur canonique n'a pas de traduction — en remplacement du `defaultValue: key` actuel, un fallback silencieux qui rend une localisation incomplète invisible à un relecteur francophone.

## Mode

**AFK** — déplacement de clés à valeurs identiques.

## Slice

`locales/{en,fr}/catalog.json` → repointage des 3 consommateurs → test de parité

## Dependencies

T145 (le test de parité doit pouvoir charger les ressources FR).

## Scope

### Nouveau namespace

- `src/locales/en/catalog.json` et `src/locales/fr/catalog.json`, deux tables :
  - `muscles.*` — clés = les **chaînes françaises canoniques** de `MUSCLE_TAXONOMY` (identité en FR, traduction en EN).
  - `equipment.*` — clés = les **slugs anglais** de `exercises.equipment`.
- Valeurs **copiées telles quelles** depuis `history:balance.muscles` et `builder:equipment`. Aucune reformulation dans ce ticket : un diff de déplacement doit rester lisible.
- Enregistrer le namespace dans `file:src/lib/i18n.ts` et dans `createTestI18n`.

### Repointage des consommateurs

- `file:src/components/history/balance/MuscleBreakdownTable.tsx`
- `file:src/components/history/balance/BalanceInsights.tsx`
- `file:src/components/builder/ExerciseFilterPanel.tsx`
- **Retirer `defaultValue: key`** partout où il masquait l'absence de traduction. Le test de parité prend le relais.
- Supprimer les anciennes clés de `history.json` et `builder.json` (EN + FR) — ne pas laisser deux sources de vérité.

### Test de parité

- `src/locales/catalogParity.test.ts` : pour chaque valeur de `MUSCLE_TAXONOMY` (importée de `file:src/lib/trainingBalance.ts`, **pas** redéclarée) et pour chaque slug d'équipement, assérer la présence d'une clé en `en` **et** en `fr`.
- Assérer aussi l'inverse : aucune clé orpheline dans `catalog.json` qui ne corresponde à aucune valeur canonique.

## Out of Scope

- Le helper de résolution et le hook (T147).
- Câbler les libellés sur les surfaces qui affichent encore du brut (T151).
- Migrer `muscle_group` vers des slugs anglais — dette assumée, tracée en issue séparée.

## Acceptance Criteria

- [ ] `catalog.json` existe en `en` et `fr` avec `muscles` (13) et `equipment` (10).
- [ ] Les 3 consommateurs lisent `catalog:*` ; les anciennes clés ont disparu de `history.json` / `builder.json`.
- [ ] Plus aucun `defaultValue: key` sur ces libellés.
- [ ] Le test de parité échoue si l'on retire une clé de `fr/catalog.json` (vérifié en le cassant volontairement).
- [ ] Aucun changement visible en FR.

## References

- Epic Brief : story 16 (une traduction manquante fait échouer la CI)
- Tech Plan : § Key Decisions (namespace, fallback), § Data Model (`catalog.json`)
- `file:src/lib/trainingBalance.ts` (`MUSCLE_TAXONOMY`)
