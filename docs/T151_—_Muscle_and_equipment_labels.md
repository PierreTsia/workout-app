# T151 — Muscle & equipment labels

## Goal

Traduire les libellés de **muscle** et d'**équipement** partout où ils s'affichent. C'est la partie la plus visible de l'issue #417 : un utilisateur anglophone voit aujourd'hui « Pectoraux » sur les badges de la bibliothèque et les pills du builder, pendant que la table d'équilibre musculaire affiche « Chest ». Trois patterns de traduction incohérents coexistent — ce ticket les unifie sur `useCatalogLabels`.

`muscle_group` **reste stocké en français canonique** ; seule la couche d'affichage change.

## Mode

**HITL** — balayage visuel : plusieurs surfaces passent de brut à traduit, la revue se fait à l'œil.

## Slice

badges + pills + filtres + body-map → `muscleLabel` / `equipmentLabel` → tests d'exhaustivité

## Dependencies

T146, T147, T148 (pour les surfaces sans embed).

## Scope

### Surfaces muscle

- Badges de `file:src/components/library/SavedWorkoutsSection.tsx` — attention au `key={m}` (103) : la **clé reste la valeur canonique**, seul le texte est traduit.
- Pills et filtres du builder, cartes de bibliothèque, `ProgramDetailSheet`, en-têtes de session.
- `file:src/lib/muscleMapping.ts` (86-108) agrège `ex.name` pour les tooltips de la body-map : le mapping vers les slugs SVG **reste sur la valeur canonique**, seul le texte du tooltip est résolu.

### Surfaces équipement

- Filtres du builder et de la bibliothèque, fiches d'exercice. Les clés sont les **slugs anglais** de la colonne DB, inchangés.

### Valeurs hors taxonomie

- `"Ischios / Bas du dos"`, `"Deltoïdes post."` et consorts existent en base et n'ont pas de clé. `muscleLabel` retombe sur la valeur brute (T147) — vérifier qu'aucune surface n'affiche une clé nue ni ne throw.

### Tests

- Rendu FR/EN d'au moins un badge, une pill et un filtre.
- Une valeur hors taxonomie s'affiche brute.
- Le test de parité de T146 couvre déjà l'exhaustivité des 13 + 10 valeurs canoniques.

## Out of Scope

- Migrer `muscle_group` vers des slugs anglais — **dette assumée et tracée en issue séparée**. Le coût réel est back-end (RPC `get_volume_by_muscle_group`, `TAXONOMY_TO_SLUGS`, alias MCP, scripts d'import, fixtures) et sans rapport avec l'affichage.
- Traduire `secondary_muscles` si sa forme diffère de `muscle_group` — à constater en build, à sortir en ticket si c'est le cas.

## Acceptance Criteria

- [ ] En `en`, aucun libellé de muscle ou d'équipement français ne subsiste à l'écran.
- [ ] En `fr`, l'affichage est identique à avant.
- [ ] Les `key` React et le mapping body-map restent assis sur la valeur canonique.
- [ ] Une valeur hors taxonomie s'affiche brute, sans crash.
- [ ] La body-map cible les mêmes groupes qu'avant dans les deux locales.

## References

- Epic Brief : stories 2 (muscles partout), 3 (équipement), 4 (non-régression FR)
- Issue [#417](https://github.com/PierreTsia/workout-app/issues/417)
- Tech Plan : § Critical Constraints (valeurs hors taxonomie), § Migration Path
- `file:src/lib/muscleMapping.ts`, `file:src/lib/trainingBalance.ts`
