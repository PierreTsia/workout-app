# T282 — Résidus admin (translations) sur le cœur

## Goal

Migrer les deux résidus admin encore sur les primitives vendorées — `TranslationReviewCard` et `ReviewAssistDialog` — vers `Textarea`/`Input`/`Button`/`Dialog` du cœur Nomos, cohérence avec la phase 1 (#611).

## Mode

`AFK`.

## Slice

`TranslationReviewCard + ReviewAssistDialog → Textarea/Input/Button/Dialog cœur → tests → QA`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos).

## Scope

| File | Change |
|---|---|
| `file:src/components/admin/translations/TranslationReviewCard.tsx` | `Textarea`/`Badge` vendor → cœur (édition inline, raccourcis clavier conservés) |
| `file:src/components/admin/translations/ReviewAssistDialog.tsx` | `Textarea`/`Dialog` vendor → cœur |

- Conserver les contrats de rendu couverts par `TranslationReviewCard.test.tsx` et `ReviewAssistDialog.test.tsx` (noms accessibles, labels FR).
- Pas de RHF ici : state local conservé.

## Out of Scope

- Logique d'adjudication/diff, cœur Nomos, autres surfaces (T274–T281, T283).
- i18n : aucune clé nouvelle.

## Acceptance Criteria

- [ ] Les 2 fichiers n'importent plus `@/components/ui/{textarea,input,dialog}`.
- [ ] `TranslationReviewCard.test.tsx` (777 l.) et `ReviewAssistDialog.test.tsx` restent verts (adaptés sans perdre d'assertion).
- [ ] Cycle rouge→vert observé ; `tsc`/`eslint`/`npm test` verts.
- [ ] Passe QA des deux surfaces (light/dark/mobile) sans régression.

## References

- Epic #612 · #583 / PR #611.
