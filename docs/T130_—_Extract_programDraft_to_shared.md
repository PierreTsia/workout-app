# T130 — Extract `programDraft` to `_shared/`

## Goal

Decouple `embedded-agent/draft.ts` from `generate-program/` by extracting the shared draft helpers into a single `_shared/programDraft.ts` module. This is the T0 preliminary refactor called out in the Tech Plan: it removes the cross-epic fragility between **#342** (Quick Workout AI migration) and **#343** (this epic), so `supabase/functions/generate-program/` becomes independently deletable by whichever epic ships last with zero coordination cost.

Addresses **Tech Plan — Critical Constraints** (`generate-program` import coupling is broken upfront via a T0 preliminary refactor).

## Mode

**AFK** — pure mechanical refactor with green-test verification.

## Slice

`_shared/` extraction → flip imports in 2 Edge functions → existing tests stay green

## Dependencies

None. This unblocks T131 and the rest of the epic.

## Scope

### New file

| File | Contents |
|---|---|
| `supabase/functions/_shared/programDraft.ts` | Re-exports of all symbols listed below; concrete implementations moved from `generate-program/` |

### Symbols to move

| Source file | Symbol | Notes |
|---|---|---|
| `supabase/functions/generate-program/prompt.ts` | `buildProgramPrompt` | function |
| `supabase/functions/generate-program/prompt.ts` | `capCatalog` | function |
| `supabase/functions/generate-program/prompt.ts` | `getEquipmentValues` | function |
| `supabase/functions/generate-program/prompt.ts` | `getExerciseBounds` | function |
| `supabase/functions/generate-program/prompt.ts` | `CatalogExercise` (type) | exported type |
| `supabase/functions/generate-program/prompt.ts` | `ProgramConstraints` (type) | exported type |
| `supabase/functions/generate-program/prompt.ts` | `RecentExercise` (type) | exported type |
| `supabase/functions/generate-program/prompt.ts` | `UserProfile` (type — alias `ProgramUserProfile` in callers) | exported type |
| `supabase/functions/generate-program/validate.ts` | `validateProgram` | function |
| `supabase/functions/generate-program/types.ts` | `GenerateProgramResponse` (type) | optional move — if the type is used only by `embedded-agent` + `generate-program`, move it; else re-export from `_shared` |

If the source files have additional internal-only helpers that don't need to be shared, leave them in place — only move the surface that `embedded-agent/draft.ts` imports.

### Import flip — `embedded-agent/draft.ts`

```diff
- import {
-   buildProgramPrompt,
-   capCatalog,
-   getEquipmentValues,
-   getExerciseBounds,
-   type CatalogExercise,
-   type ProgramConstraints,
-   type RecentExercise,
-   type UserProfile as ProgramUserProfile,
- } from "../generate-program/prompt.ts"
- import { validateProgram } from "../generate-program/validate.ts"
- import type { GenerateProgramResponse } from "../generate-program/types.ts"
+ import {
+   buildProgramPrompt,
+   capCatalog,
+   getEquipmentValues,
+   getExerciseBounds,
+   validateProgram,
+   type CatalogExercise,
+   type ProgramConstraints,
+   type RecentExercise,
+   type UserProfile as ProgramUserProfile,
+   type GenerateProgramResponse,
+ } from "../_shared/programDraft.ts"
```

### Import flip — `generate-program/index.ts`

Update internal imports inside `generate-program/` (the function still exists post-refactor; it just imports from `_shared` instead of its sibling files). `prompt.ts` and `validate.ts` become thin re-export files OR are deleted entirely if no other consumer remains — verify with `rg` before deletion.

### Tests

Move co-located tests for the extracted symbols (`prompt_test.ts`, `validate_test.ts` portions) into `_shared/programDraft_test.ts`. If splitting a test file is awkward (single file covers both moved + non-moved code), keep the file in place and import from `_shared/`.

## Out of Scope

- Deleting `supabase/functions/generate-program/index.ts` or `gemini.ts` (the Edge function still serves Quick Workout AI until #342 cuts over).
- Any behavioral change — this is a rename + import flip only.
- Inlining `_shared/programCatalog.ts` (separate prior extraction; out of scope).

## Acceptance Criteria

- [ ] `supabase/functions/_shared/programDraft.ts` exists and exports `buildProgramPrompt`, `capCatalog`, `getEquipmentValues`, `getExerciseBounds`, `validateProgram` + 4 (or 5) types.
- [ ] `supabase/functions/embedded-agent/draft.ts` no longer imports from `../generate-program/*` (verify: `rg "from \"\.\./generate-program" supabase/functions/embedded-agent/` returns empty).
- [ ] `supabase/functions/generate-program/index.ts` imports the moved symbols from `../_shared/programDraft.ts`.
- [ ] All existing Deno unit tests under `supabase/functions/embedded-agent/` and `supabase/functions/generate-program/` pass unchanged.
- [ ] `e2e/onboarding.spec.ts` passes (Embedded Agent draft step still works end-to-end).
- [ ] `e2e/quick-workout-ai.spec.ts` passes (Quick Workout flow still works — companion epic regression gate).

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Sequencing with #342)
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Critical Constraints — T0 preliminary refactor)
- Companion Tech Plan: `docs/Tech_Plan_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md`
- Source files: `file:supabase/functions/embedded-agent/draft.ts:25-26`, `file:supabase/functions/generate-program/prompt.ts`, `file:supabase/functions/generate-program/validate.ts`
