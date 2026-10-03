# T278 — Builder (8 fichiers) sur le cœur

## Goal

Migrer les champs de formulaire du builder de programme (8 fichiers) des primitives vendorées `input`/`textarea`/`select` vers celles du cœur Nomos.

## Mode

`AFK`.

## Slice

`builder/* (8 fichiers) → Input/Textarea/Select/Field cœur → tests → QA builder`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos).

## Scope

| File | Change |
|---|---|
| `file:src/components/builder/ExerciseDetailForm.tsx` | champs → `Field`/`Input`/`Textarea`/`Select` cœur |
| `file:src/components/builder/DayEditor.tsx` | idem |
| `file:src/components/builder/ExerciseRow.tsx` | idem |
| `file:src/components/builder/BuilderHeader.tsx` | idem |
| `file:src/components/builder/ExerciseLibraryPicker.tsx` | idem |
| `file:src/components/builder/BlockEditor.tsx` | idem |
| `file:src/components/builder/PerRoundGrid.tsx` | idem |
| `file:src/components/builder/UniformExerciseList.tsx` | idem |

- Pas de migration RHF (ces fichiers n'utilisent pas le wrapper `form`) : uniquement remplacer `@/components/ui/{input,textarea,select}` par le cœur, en conservant le state local/contrôlé.

## Out of Scope

- Logique du builder (dnd, progression), cœur Nomos, autres surfaces (T274–T277, T279–T283).
- i18n : aucune clé nouvelle.

## Acceptance Criteria

- [ ] Les 8 fichiers n'importent plus `@/components/ui/{input,textarea,select}`.
- [ ] Édition du builder (jours, blocs, exercices, prescriptions) fonctionne comme avant.
- [ ] Tests builder (adaptés/créés) verts avec cycle rouge→vert ; `tsc`/`eslint`/`npm test` verts.
- [ ] Passe QA builder (light/dark/mobile, desktop + mobile) sans régression.

## References

- Epic #612 · #583 / PR #611.
