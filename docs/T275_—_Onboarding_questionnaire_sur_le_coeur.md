# T275 — Onboarding (questionnaire) sur le cœur

## Goal

Migrer le questionnaire d'onboarding (`QuestionnaireStep` + `QuestionnaireTrainingFields`, 44 usages `FormField`) du wrapper RHF vendoré vers `Field`/`Form`/`Input`/`Select` du cœur Nomos, RHF+zod conservés.

## Mode

`AFK`.

## Slice

`QuestionnaireStep + QuestionnaireTrainingFields → primitives cœur → tests → QA onboarding`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos).

## Scope

| File | Change |
|---|---|
| `file:src/components/onboarding/QuestionnaireStep.tsx` | `Form` vendor → `Form` cœur ; suppression du wrapper RHF shadcn |
| `file:src/components/onboarding/QuestionnaireTrainingFields.tsx` | `FormField`/`FormItem`/`FormControl`/`FormMessage` → `Field` ; `Input`/`Select` cœur |

- RHF (`useForm`) et le schéma zod conservés ; `Field.error` ← `formState.errors.*.message`.

## Out of Scope

- Autres surfaces (T274, T276–T283), cœur Nomos.
- i18n : aucune clé nouvelle.

## Acceptance Criteria

- [ ] Les deux fichiers n'importent plus `@/components/ui/form` ni `@/components/ui/{input,select}`.
- [ ] Le parcours onboarding (étapes, champs conditionnels de training) se comporte comme avant ; validation équivalente.
- [ ] Test composant du questionnaire vert avec cycle rouge→vert ; `tsc`/`eslint`/`npm test` verts.
- [ ] Passe QA du parcours onboarding (light/dark/mobile) sans régression.

## References

- Epic #612 · #583 / PR #611.
