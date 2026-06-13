# T144 — Top-level "Create circuit" entry

## Goal

Offrir un point d'entrée de premier niveau pour créer un circuit ad-hoc (hors program builder), via un jour `program_id: null`, et router directement vers l'éditeur de bloc. Couvre la story 19 (entrée top-level / découvrabilité) et le verrou « day-scoped + entrée top-level ».

## Mode

**AFK** — place tranchée : **entrée dédiée depuis le home / menu principal** (décidée pendant le split).

## Slice

`useCreateAdhocBlock` → entrée UI home/menu → route vers `BlockEditor` → vitest

## Dependencies

T139 (l'éditeur de bloc doit exister).

## Scope

### Hook — `useCreateAdhocBlock`

- Crée un `workout_days` avec `program_id: null` (pattern `file:src/hooks/useCreateQuickWorkout.ts`), label par défaut (« Circuit » + emoji), `sort_order: 0`.
- Crée un `exercise_blocks` vide (ou pré-rempli depuis une sélection picker) rattaché à ce jour.
- Retourne `{ dayId, blockId }` pour router vers `BlockEditor`.

### UI — entrée home/menu

- Entrée dédiée « Créer un circuit » accessible depuis le home / menu principal (hors `/builder/:programId`).
- Au tap → `useCreateAdhocBlock` → navigation vers l'édition du bloc (`BlockEditor`).
- Le jour ad-hoc créé est exécutable comme n'importe quelle séance (réutilise T141/T142).

## Out of Scope

- Bibliothèque de blocs réutilisables / blocs publics (epic ultérieur).
- AI proposant des blocs (hors v1).

## Acceptance Criteria

- [ ] Une entrée « Créer un circuit » est présente dans le home / menu principal.
- [ ] Le tap crée un jour `program_id: null` + un bloc, et ouvre `BlockEditor`.
- [ ] Le circuit ad-hoc créé est éditable (T139) et exécutable en séance (T141/T142).
- [ ] Le jour ad-hoc reste privé au user (RLS via `workout_days.user_id`).
- [ ] Tests vitest : `useCreateAdhocBlock` (jour ad-hoc + bloc, shape).

## References

- Epic Brief : story 19 ; § Scope (day-scoped + entrée top-level)
- Tech Plan : § Component Architecture (`useCreateAdhocBlock`), § Key Decisions (Portée du bloc / Point d'entrée)
- Pattern ad-hoc : `file:src/hooks/useCreateQuickWorkout.ts`
