# T277 — Create-program + embedded agent sur le cœur

## Goal

Migrer `BlankProgramStep` (wrapper RHF) et `EmbeddedAgentChatStep` (input vendor) vers les primitives du cœur Nomos.

## Mode

`AFK`.

## Slice

`BlankProgramStep + EmbeddedAgentChatStep → primitives cœur → tests → QA`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos).

## Scope

| File | Change |
|---|---|
| `file:src/components/create-program/BlankProgramStep.tsx` | `FormField`/`FormItem`/`FormControl`/`FormMessage` → `Field` cœur ; RHF+zod conservés |
| `file:src/components/embedded-agent/EmbeddedAgentChatStep.tsx` | `Input`/`Textarea` vendor → cœur (pas de RHF si champ contrôlé) |

## Out of Scope

- Logique agent embarqué (hors design), cœur Nomos, autres surfaces (T274–T276, T278–T283).
- i18n : aucune clé nouvelle.

## Acceptance Criteria

- [ ] Les 2 fichiers n'importent plus `@/components/ui/{form,input,textarea}`.
- [ ] Le pas de création de programme et la saisie de chat se comportent comme avant.
- [ ] Tests verts avec cycle rouge→vert ; `tsc`/`eslint`/`npm test` verts.
- [ ] Passe QA des deux surfaces sans régression.

## References

- Epic #612 · #583 / PR #611.
