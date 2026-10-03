# T281 — Library + Profile sur le cœur

## Goal

Migrer `CreateProgramDialog`, `ExerciseLibraryPage` et `ProfilePage` des primitives vendorées vers celles du cœur Nomos.

## Mode

`AFK`.

## Slice

`CreateProgramDialog + ExerciseLibraryPage + ProfilePage → Input/Textarea/Select/Field cœur → tests → QA`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos).

## Scope

| File | Change |
|---|---|
| `file:src/components/library/CreateProgramDialog.tsx` | champs → cœur (dialog cœur) |
| `file:src/pages/library/ExerciseLibraryPage.tsx` | `Input`/`Select` → cœur |
| `file:src/pages/ProfilePage.tsx` | champs → cœur (TooltipProvider local conservé jusqu'à migration tooltip, hors périmètre) |

## Out of Scope

- Logique métier, cœur Nomos, autres surfaces (T274–T280, T282–T283).
- i18n : aucune clé nouvelle.

## Acceptance Criteria

- [ ] Les 3 fichiers n'importent plus `@/components/ui/{input,textarea,select}`.
- [ ] Création de programme, recherche library et édition du profil fonctionnent comme avant.
- [ ] Tests verts avec cycle rouge→vert ; `tsc`/`eslint`/`npm test` verts.
- [ ] Passe QA des 3 surfaces sans régression.

## References

- Epic #612 · #583 / PR #611.
