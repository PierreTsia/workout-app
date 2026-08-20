# T150 — History grouping on `exercise_id`

## Goal

L'historique est la surface la plus délicate de l'epic : le nom snapshoté n'y est pas qu'un libellé, c'est une **clé de regroupement, de tri SQL et de rendu React**. Localiser naïvement casserait le groupement. Ce ticket bascule la logique sur `exercise_id` + `logged_at`, puis traduit l'affichage.

Corrige au passage un bug latent : deux séances du même exercice renommé entre-temps produisent aujourd'hui deux groupes distincts.

## Mode

**AFK** — l'ordre cible (`logged_at`) est arbitré.

## Slice

`useSessionSetLogs` order → `sessionHistoryGrouping` → `useExerciseHistory` → surfaces d'historique

## Dependencies

T147, T148.

## Scope

### `useSessionSetLogs`

- `.order("exercise_name_snapshot")` → `.order("logged_at").order("set_number")` (13-14).

### `sessionHistoryGrouping`

- Les **solos** sont regroupés par `exercise_id` (plus par nom consécutif, 106), `key` React sur `exercise_id` (114), et les groupes ordonnés par leur **premier `logged_at`**.
- **La branche bloc ne bouge pas** : les circuits sont déjà triés par `blockSortOrder`, une clé indépendante de la langue, et la fonction rend toujours `[...blocs, ...solos]` (T143). Ne pas fusionner les deux listes par `logged_at`.
- Le groupe n'expose plus un `name` figé mais la ligne `exercise` jointe ; la résolution du libellé se fait à la couche de rendu.
- Le `reduce` actuel mute (`last.sets.push`) : réécriture déclarative, conformément à la règle de style du repo.
- Le commentaire de tête (88-89) affirme que les logs arrivent triés par `exercise_name_snapshot` — à réécrire.

### `useExerciseHistory`

- Dédoublonne sur `exercise_id` (déjà le cas) et trie sur le **label résolu** avec `localeCompare(locale)` (31-32). Un combobox alphabétique doit l'être dans la langue du lecteur — contrairement à l'ordre d'une séance, qui doit rester chronologique.

### Surfaces

- `SessionRow`, `SessionSetLogs`, `BlockHistoryCard`, `ExerciseTab`.
- `file:src/components/history/ExerciseTab.tsx` (32) filtre sur le nom : le filtre doit porter sur le **libellé affiché**, sinon taper « Bench » ne trouve rien alors que « Bench Press » est à l'écran.

### Tests

- Ordre des solos par `logged_at`, y compris quand l'ordre alphabétique diffère.
- Deux séances du même `exercise_id` renommé → **un seul** groupe.
- Blocs : ordre et composition « circuits d'abord » strictement inchangés (le test T143 existant doit passer tel quel).
- Rendu FR/EN de `SessionRow`.

## Out of Scope

- Muscles et équipement (T151).
- Persister quoi que ce soit : `exercise_name_snapshot` continue d'être écrit.

## Acceptance Criteria

- [ ] Les groupes solos suivent l'ordre chronologique de la séance, identique en FR et en EN.
- [ ] Un exercice renommé entre deux séances produit un seul groupe.
- [ ] Les tests de circuits existants passent sans modification.
- [ ] Le filtre de `ExerciseTab` porte sur le libellé affiché.
- [ ] Le picker d'historique est trié alphabétiquement dans la langue courante.

## References

- Epic Brief : stories 1 (noms EN), 6 (historique groupé par identité — l'exception documentée à la story 4)
- Tech Plan : § Critical Constraints (le nom porte de la logique), § Component Responsibilities
- `file:src/lib/sessionHistoryGrouping.ts`
