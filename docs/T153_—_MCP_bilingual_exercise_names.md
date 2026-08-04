# T153 — MCP bilingual exercise names

## Goal

`search_exercises` et `resolve_exercises` retournent déjà les deux noms au format `**name** (name_en)` ; `get_program_details` et `get_upcoming_workouts` ne retournent que le `name_snapshot`. Un agent qui lit un programme voit donc du français là où la recherche lui donnait les deux langues — une incohérence de surface qui dégrade la résolution d'exercices côté agent.

Alignement de format, **sans locale**. C'est l'origine directe de la PR [#416](https://github.com/PierreTsia/workout-app/pull/416) : le contributeur avait raison sur le symptôme, la correction se fait ici et pas à l'écriture du snapshot.

## Mode

**AFK** — le format est déjà établi par les deux outils existants.

## Slice

`getProgramDetails` + `getUpcomingWorkouts` → format bilingue → SKILL.md

## Dependencies

Aucune.

## Scope

### Outils

- `file:supabase/functions/mcp/tools/getProgramDetails.ts` et `file:supabase/functions/mcp/tools/getUpcomingWorkouts.ts` joignent la ligne catalogue et rendent `**name** (name_en)`.
- Réutiliser le formateur existant de `searchExercises` / `resolveExercises` plutôt que d'en écrire un troisième. S'il n'est pas extrait, l'extraire.
- Omettre la parenthèse quand `name_en` est absent ou vide — ne jamais rendre `**Développé couché** ()`.

### Pas de locale

- Aucune lecture de `user_profiles`, aucun en-tête `Accept-Language`. Les outils MCP sont auth-only aujourd'hui ; leur ajouter une lecture de profil est une surface d'authentification supplémentaire que la v1 ne justifie pas. Donner les deux noms à l'agent le laisse choisir — c'est ce qu'il fait déjà avec `search_exercises`.

### Documentation

- Mettre `SKILL.md` à jour si le format y est décrit.

## Out of Scope

- Le paramètre `locale` sur les RPC `search_exercises` / `resolve_exercises_batch` et le biais français de leur ranking → **v1.5**, conditionné à la mesure de T154.
- Toute écriture : `name_snapshot` reste écrit tel quel côté MCP comme côté web.

## Acceptance Criteria

- [x] `get_program_details` et `get_upcoming_workouts` rendent `**name** (name_en)`.
- [x] Un exercice sans `name_en` rend le nom seul, sans parenthèse vide.
- [x] Le format est identique à celui de `search_exercises` (formateur partagé).
- [x] Aucune lecture de profil ajoutée.
- [x] Aucun chemin d'écriture modifié.

Implémenté dans #450 / `file:docs/T162_—_MCP_English_instructions_and_bilingual_names.md`.

## References

- Epic Brief : story 13 (les deux noms sur `get_program_details` / `get_upcoming_workouts`)
- PR d'origine : [#416](https://github.com/PierreTsia/workout-app/pull/416) ; issue : [#415](https://github.com/PierreTsia/workout-app/issues/415)
- Tech Plan : § Key Decisions (MCP), § Modified Files
