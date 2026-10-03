# T283 — Retirement du wrapper form vendoré + audit

## Goal

Clore l'epic #612 : supprimer `src/components/ui/form.tsx` (wrapper RHF shadcn) une fois sans consommateur, et auditer/vérifier que les primitives vendorées de champ restantes (`input`, `textarea`, `select`) n'ont plus de consommateur ou documenter leur maintien.

## Mode

`AFK`.

## Slice

`audit consommateurs → suppression wrapper form.tsx → suite complète + @qa`

## Dependencies

- T274, T275, T276, T277, T278, T279, T280, T281, T282.

## Scope

- Vérifier par recherche qu'aucun fichier n'importe `@/components/ui/form`.
- Supprimer `file:src/components/ui/form.tsx` (et son test éventuel).
- Auditer `input.tsx` / `textarea.tsx` / `select.tsx` : supprimer si zéro consommateur, sinon documenter les usages restants (le reste de `src/components/ui/*` est conservé, il sert toute l'app).
- Vérifier que `src/locales/locales.test.ts` reste vert (aucune clé i18n orpheline).

## Out of Scope

- Cœur Nomos, phase 2 (#591).
- Suppression des primitives `src/components/ui/*` encore utilisées.

## Acceptance Criteria

- [ ] `rg "@/components/ui/form"` → vide ; `src/components/ui/form.tsx` supprimé.
- [ ] Décision documentée (supprimé/maintien) pour `input/textarea/select`.
- [ ] `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, `npm test` verts.
- [ ] `locales.test.ts` vert.
- [ ] Passe QA complète des surfaces migrées (diff documenté), avec au moins une capture FR.

## References

- Epic #612 · #583 / PR #611.
