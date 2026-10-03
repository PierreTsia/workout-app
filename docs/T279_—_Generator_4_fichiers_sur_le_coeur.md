# T279 — Generator (4 fichiers) sur le cœur

## Goal

Migrer les champs de formulaire du générateur de programme (4 fichiers) des primitives vendorées vers celles du cœur Nomos.

## Mode

`AFK`.

## Slice

`generator/* (4 fichiers) → Input/Textarea/Select/Field cœur → tests → QA generator`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos).

## Scope

| File | Change |
|---|---|
| `file:src/components/generator/ConstraintStep.tsx` | champs → cœur |
| `file:src/components/generator/ExerciseAddPicker.tsx` | champs → cœur |
| `file:src/components/generator/PreviewStep.tsx` | champs → cœur |
| `file:src/components/generator/SaveAsProgramPrompt.tsx` | champs → cœur |

- Conserver le state existant (pas de wrapper RHF dans ces fichiers).

## Out of Scope

- Logique de génération IA, cœur Nomos, autres surfaces (T274–T278, T280–T283).
- i18n : aucune clé nouvelle.

## Acceptance Criteria

- [ ] Les 4 fichiers n'importent plus `@/components/ui/{input,textarea,select}`.
- [ ] Saisie des contraintes et sauvegarde du programme généré fonctionnent comme avant.
- [ ] Tests verts avec cycle rouge→vert ; `tsc`/`eslint`/`npm test` verts.
- [ ] Passe QA du parcours générateur sans régression.

## References

- Epic #612 · #583 / PR #611.
