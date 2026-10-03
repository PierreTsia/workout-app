# T270 — Formulaire d'édition sur les primitives cœur

## Goal

Migrer le formulaire d'édition d'exercice (`ExerciseEditForm` et ses satellites) des primitives shadcn vendorées vers `Field` / `Form` / `Input` / `Textarea` / `Select` du cœur Nomos, en **conservant RHF + zod** (le cœur n'a aucun moteur de validation, ADR nomos 0015). Le formulaire est partagé par `/admin/exercises/:id` et `/admin/review`.

## Mode

`AFK` — décisions déjà tranchées (RHF conservé, `Field`/`Form` comme enveloppes).

## Slice

`primitives cœur → ExerciseEditForm + InstructionFieldArray + LlmJsonImport + ExerciseReviewToolbar → pages edit/review → vitest`

## Dependencies

- T268 (primitives cœur disponibles).

## Scope

### Composants

| File | Change |
|---|---|
| `file:src/components/admin/exercise-form/ExerciseEditForm.tsx` | Champs RHF enveloppés dans `Field` (`label`/`hint`/`error`) ; layout via `Form` (`columns`, `actions`) ; `Input`/`Textarea`/`Select` du cœur ; suppression des primitives `@/components/ui/*` correspondantes |
| `file:src/components/admin/exercise-form/InstructionFieldArray.tsx` | `Input`/`Button` du cœur, `Field` par étape |
| `file:src/components/admin/exercise-form/LlmJsonImport.tsx` | `Collapsible`/`Textarea`/`Button` du cœur |
| `file:src/components/admin/review/ExerciseReviewToolbar.tsx` | `Button` du cœur |
| `file:src/pages/AdminExerciseEditPage.tsx`, `AdminReviewPage.tsx` | `Button`/`Badge` du cœur au niveau page |

### Validation

- RHF (`useForm`, `useFieldArray`) et le schéma zod (`file:src/components/admin/exercise-form/schema.ts`) sont **conservés intacts** ; `Field.error` reçoit `formState.errors.*.message`.
- Pas de moteur de validation Nomos (n'existe pas).

### i18n

- Réutiliser les clés `admin:form.*` existantes. Toute nouvelle clé éventuelle → `microcopy` (EN+FR).

## Out of Scope

- Tables (T269, T271).
- Coquilles de page hors formulaire (T272).

## Acceptance Criteria

- [ ] `ExerciseEditForm` n'importe plus les primitives `@/components/ui/{input,textarea,select,separator,collapsible,form,label}` remplacées par le cœur.
- [ ] RHF + zod conservés : la validation (champ requis, formats) se comporte comme avant.
- [ ] `Field` affiche label/hint/erreur ; `Form` gère le layout 2 colonnes et les actions.
- [ ] `/admin/exercises/:id` et `/admin/review` rendent le formulaire migré ; toolbar en `Button` cœur.
- [ ] Tests composant du formulaire (créés ou adaptés) verts ; `npm test` + `npm run lint` passent.
- [ ] EN + FR cohérents avec le contrat (pas de wording inventé hors `microcopy`).
- [ ] Passe @qa sur les deux pages (light/dark/mobile) sans régression fonctionnelle de sauvegarde.

## References

- Tech Plan : § Component Architecture (formulaire), § Key Decisions (RHF conservé).
- Epic : GitHub #583. Ticket lié : T268 (dep), T272 (coquilles review).
