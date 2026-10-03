# T274 — Formulaire feedback utilisateur sur le cœur

## Goal

Migrer `FeedbackForm` (soumission de feedback par l'utilisateur final) du wrapper RHF vendoré `@/components/ui/form` vers `Field`/`Form`/`Input`/`Textarea`/`Select` du cœur Nomos, RHF+zod conservés. Surface la plus dense en `FormField` (53 usages) — premier ticket de l'epic #612.

## Mode

`AFK`.

## Slice

`FeedbackForm → primitives cœur (Field/Form/…) → tests composant → QA`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos : `@nomosui/react@0.7.0`, tokens, provider).

## Scope

| File | Change |
|---|---|
| `file:src/components/feedback/FeedbackForm.tsx` | `FormField`/`FormItem`/`FormControl`/`FormMessage` → `Field` (`label`/`hint`/`error`) ; `Input`/`Textarea`/`Select` cœur ; RHF (`useForm`, `zodResolver`) et le schéma zod conservés |

- `Field.error` reçoit `formState.errors.*.message`.
- Le cœur n'a pas de validation (ADR nomos 0015) : toute la logique RHF/zod reste.

## Out of Scope

- Autres surfaces (T275–T283), cœur Nomos.
- i18n : aucune clé nouvelle (réutiliser `feedback.*` existant).

## Acceptance Criteria

- [ ] `FeedbackForm` n'importe plus `@/components/ui/form`, ni `@/components/ui/{input,textarea,select}`.
- [ ] RHF+zod conservés : soumission, champs requis, messages d'erreur équivalents à avant.
- [ ] Test composant du formulaire (adapté/créé) vert, avec un vrai cycle rouge→vert.
- [ ] `npx tsc -p tsconfig.app.json --noEmit`, `eslint <fichiers>`, `npm test` verts.
- [ ] Passe QA de la soumission feedback (light/dark/mobile) sans régression.

## References

- Epic #612 · #583 / PR #611 · `docs/Tech_Plan_—_Adopter_Nomos_phase_1_surfaces_admin_#583.md`.
