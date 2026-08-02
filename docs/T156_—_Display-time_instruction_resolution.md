# T156 — Display-time instruction resolution

## Goal

Poser le schéma et la règle de résolution qui rendent les consignes d'exercice affichables en anglais, et basculer les trois surfaces qui les rendent. Sans une seule ligne d'anglais en base, ce ticket est un **no-op visible en production** : c'est exactement sa valeur, il permet de vérifier la migration et le résolveur indépendamment du contenu.

Le résolveur ne choisit pas seulement une langue, il rend `null` quand il n'y a rien à afficher — ce qui absorbe le bloc `hasInstructions` aujourd'hui **dupliqué dans trois composants**.

Couvre les stories 1, 2, 3, 4, 16, 17 et 18 de l'Epic Brief.

## Mode

**AFK** — la matrice de repli est mécanique à vérifier, et aucune décision d'architecture ne reste ouverte.

## Slice

migration + CHECK → `src/types/database.ts` → `resolveExerciseInstructions` → `useCatalogLabels` → 3 surfaces → `FULL_EXERCISE_SELECT` → vitest

## Dependencies

Aucune.

## Scope

### Migration

```sql
-- supabase/migrations/<timestamp>_add_english_instructions.sql
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_en jsonb;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_en_status text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_en_reviewed_at timestamptz;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions_en_audit jsonb;

ALTER TABLE exercises
  ADD CONSTRAINT exercises_instructions_en_status_chk
  CHECK (instructions_en_status IN ('clean', 'flagged', 'approved'));
```

Nullable sans défaut : `NULL` signifie « jamais traduit », distinct de « traduit et propre ». Aucun changement de RLS — les nouvelles colonnes héritent des policies de `file:supabase/migrations/20260313140002_exercises_rls.sql`.

### Types

`file:src/types/database.ts` est **maintenu à la main**, aucun codegen. Étendre `Exercise` avec les quatre champs, en réemployant `ExerciseInstructions` tel quel pour `instructions_en` — la forme est identique, pas de variante de type.

Ajouter aussi le type `TranslationAudit`, **bien que rien ici ne le consomme** : T157 l'écrit et T158 le lit, et ces deux tickets sont censés tourner en parallèle. Le contrat descend donc au niveau commun.

| Champ | Type |
|---|---|
| `model` | `string` |
| `prompt_version` | `number` |
| `translated_at` | `string` |
| `checker_model` | `string \| null` |
| `gate_flags` | `string[]` |
| `objections` | `{ section: keyof ExerciseInstructions; index: number; verdict: string; note: string }[]` |

### Résolveur

`resolveExerciseInstructions(source, locale)` dans `file:src/lib/catalogLabels.ts`, à côté de `resolveExerciseName` et sous les mêmes contraintes : aucun import React ni i18next, testable dans les deux locales sans rendu. Le test de pureté en `?raw` de `file:src/lib/catalogLabels.test.ts` doit continuer de passer.

Règle : l'anglais est retenu si **et seulement si** `isEnglish(locale)`, statut ∈ {`clean`, `approved`}, et **parité de présence** des sections — toute section non vide en français doit être non vide en anglais. Sinon, repli **en bloc** sur le français. Jamais un panneau mi-anglais mi-français : c'est le défaut que l'issue a rapporté.

Le retour est `ExerciseInstructions | null`, `null` signifiant « rien à afficher ». Tout statut nul, inconnu, ou absent de la projection **échoue fermé** vers le français.

`useCatalogLabels` (`file:src/hooks/useCatalogLabels.ts`) gagne `exerciseInstructions(row)`, lié à `i18n.language` comme les résolveurs existants. Aucune nouvelle source de locale.

### Surfaces

| Fichier | Changement |
|---|---|
| `file:src/components/exercise/ExerciseInstructionsPanel.tsx` | Supprimer le bloc `hasInstructions` (29-34) au profit du résolveur |
| `file:src/components/exercise/ExerciseInfoDialog.tsx` | Idem (27-32) ; utilise déjà `useCatalogLabels` pour le titre |
| `file:src/components/generator/ExerciseDetailSheet.tsx` | Idem ; `const ins = exercise.instructions` (33) devient le bloc résolu |

`file:src/components/exercise/InstructionSection.tsx` reste inchangé : il reçoit déjà des `string[]` et ses titres passent par i18next.

### Projection

`file:src/lib/exerciseSelects.ts` — `FULL_EXERCISE_SELECT` gagne `instructions_en` et `instructions_en_status`. **Pas** l'audit, qui ne sert qu'à l'écran de relecture et voyagera par le RPC de T158.

C'est une nécessité, pas un confort : `file:src/hooks/useWorkoutExercises.ts` préchauffe le cache `["exercise", id]` depuis cette projection, et `ExerciseInstructionsPanel` lit ce cache sans refetch. Une projection incomplète ferait diverger le même panneau selon qu'on l'ouvre depuis une séance ou depuis la bibliothèque. `LABEL_EXERCISE_SELECT` reste intouchée, elle ne porte aucune instruction.

### Garde-fous

**Test d'architecture** — un grep sur `src/components/**` interdisant toute lecture de `.instructions` hors du résolveur, sur le modèle du test de pureté en `?raw` déjà pratiqué. C'est le garde-fou du mode d'échec que l'ADR 0010 documente : une surface qui oublie le helper rend du français en silence, invisible pour un relecteur francophone.

**Test d'épinglage de `search_exercises`** — `file:supabase/migrations/20260326120000_search_exercises.sql` est `RETURNS SETOF exercises` avec un `SELECT e.*`, et c'est **la seule raison** pour laquelle `SwapExerciseSheet` verra les traductions : c'est la seule surface qui passe une ligne paginée sans refetch par id. Un test doit affirmer que les nouvelles colonnes circulent par ce RPC, pour qu'un futur passage à une projection explicite casse un test au lieu de casser la fonctionnalité en silence.

### Tests

- Matrice de repli du résolveur : `instructions_en` nul, statut nul, `flagged`, `clean`, `approved`, statut inconnu, parité de sections violée, blocs vides des deux côtés.
- Les deux locales sur au moins une des trois surfaces, via `renderWithProviders(..., { locale })`.
- Le français rendu à l'identique quel que soit le statut.

## Out of Scope

- Toute production de traduction : c'est T157.
- Toute surface admin : c'est T158.
- La colonne `has_instructions` de `file:src/components/admin/exercises-table/columns.tsx` reste assise sur le **français** — c'est un indicateur de contenu source, pas d'affichage.
- Le sur-poids préexistant de `search_exercises`, qui renvoie `e.*` et transporte donc des instructions qu'aucune liste n'affiche. Dette antérieure, à sortir en issue.

## Acceptance Criteria

- [ ] La migration passe en local et le `CHECK` rejette un statut hors vocabulaire.
- [ ] La matrice de repli est couverte en test, y compris statut inconnu et parité de sections violée.
- [ ] Le test de pureté de `catalogLabels` passe toujours (aucun import React ni i18next).
- [ ] Un test d'architecture échoue si un composant lit `.instructions` hors du résolveur.
- [ ] Un test affirme que `search_exercises` renvoie `instructions_en` et son statut.
- [ ] Aucun des trois composants ne contient plus son propre bloc `hasInstructions`.
- [ ] En `fr`, l'affichage est identique à avant, quel que soit le statut de la ligne.
- [ ] **Démo** : sur une ligne semée à la main en `clean`, l'app en anglais affiche l'anglais ; basculée en `flagged`, elle réaffiche le français sans rechargement de page.

## References

- Epic Brief : `docs/Epic_Brief_—_English_Exercise_Instructions_#417.md`, stories 1, 2, 3, 4, 16, 17, 18
- Tech Plan : `docs/Tech_Plan_—_English_Exercise_Instructions_#417.md`, § Data Model, § Critical Constraints (cache préchauffé, `SwapExerciseSheet`)
- ADR 0010 : `docs/adr/0010-localize-catalog-at-display-time.md`
- Issue [#417](https://github.com/PierreTsia/workout-app/issues/417)
- `file:src/lib/catalogLabels.ts`, `file:src/lib/exerciseSelects.ts`
