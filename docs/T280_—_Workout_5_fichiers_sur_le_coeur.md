# T280 — Workout (5 fichiers) sur le cœur

## Goal

Migrer les champs de formulaire liés à la séance (5 fichiers) des primitives vendorées vers celles du cœur Nomos.

## Mode

`AFK`.

## Slice

`workout/* (5 fichiers) → Input/Textarea/Select/Field cœur → tests → QA séance`

## Dependencies

- #583 / PR #611 mergée (fondation Nomos).

## Scope

| File | Change |
|---|---|
| `file:src/components/workout/SessionNote.tsx` | `Textarea` cœur |
| `file:src/components/workout/SetsTable.tsx` | `Input` cœur |
| `file:src/components/workout/DurationSetTimer.tsx` | `Input` cœur |
| `file:src/components/workout/SwapExerciseSheet.tsx` | champs → cœur |
| `file:src/components/workout/DeviationReasonSheet.tsx` | champs → cœur |

- Conserver le state existant ; ne pas toucher à la logique de séance/timer.

## Out of Scope

- Logique de séance (progression, timers), cœur Nomos, autres surfaces (T274–T279, T281–T283).
- i18n : aucune clé nouvelle.

## Acceptance Criteria

- [ ] Les 5 fichiers n'importent plus `@/components/ui/{input,textarea,select}`.
- [ ] Saisie des séries, notes, durée, swap et motif de déviation fonctionnent comme avant.
- [ ] Tests verts avec cycle rouge→vert ; `tsc`/`eslint`/`npm test` verts.
- [ ] Passe QA séance (saisie de séries, timer) sans régression.

## References

- Epic #612 · #583 / PR #611.
