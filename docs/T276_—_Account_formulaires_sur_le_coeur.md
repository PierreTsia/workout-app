# T276 — Account (page + PAT + validation) sur le cœur

## Goal

Migrer les formulaires du compte (`AccountPage`, `AccountValidationMessage`, `CreatePATDialog`) du wrapper RHF vendoré vers `Field`/`Form`/`Input` du cœur Nomos, RHF+zod conservés.

## Mode

`AFK`.

## Slice

`AccountPage + AccountValidationMessage + CreatePATDialog → primitives cœur → tests → QA account`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos).

## Scope

| File | Change |
|---|---|
| `file:src/pages/AccountPage.tsx` | `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl` vendor → `Form`/`Field` cœur |
| `file:src/components/account/AccountValidationMessage.tsx` | `FormMessage`/`useFormField` vendor → `Field` cœur (message d'erreur via `Field.error`) |
| `file:src/components/account/CreatePATDialog.tsx` | `FormField`/… et `Input`/`Dialog` cœur ; RHF conservé |

- RHF+zod conservés ; comportement de validation identique.

## Out of Scope

- Autres surfaces (T274–T275, T277–T283), cœur Nomos.
- i18n : aucune clé nouvelle.

## Acceptance Criteria

- [ ] Aucun des 3 fichiers n'importe `@/components/ui/form` ni `@/components/ui/input`.
- [ ] Création de PAT et validation du formulaire compte fonctionnent comme avant (messages d'erreur inclus).
- [ ] Tests (adaptés/créés) verts avec cycle rouge→vert ; `tsc`/`eslint`/`npm test` verts.
- [ ] Passe QA account (light/dark/mobile) sans régression.

## References

- Epic #612 · #583 / PR #611.
