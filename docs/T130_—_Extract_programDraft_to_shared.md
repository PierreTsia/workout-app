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

### New files

| File | Contents |
|---|---|
| `supabase/functions/_shared/programDraft.ts` | Pure-TS module: types, prompt builder, validator. Vitest-importable. |
| `supabase/functions/_shared/programGemini.ts` | Deno-only `callGeminiProgram` HTTP call (separated so `programDraft.ts` stays vitest-importable). |

### Why two files (not one)

`embedded-agent/index.ts` also imports `callGeminiProgram` from `generate-program/gemini.ts` — caught during execution as a third cross-Edge dependency not listed in the original ticket draft. Initial attempt: unify everything in `programDraft.ts`. Result: `tsc` (following imports from `src/test/*.test.ts`) chokes on `Deno.env.get` + `Array.findLast` reachability. Split is forced by the type system; it also happens to be the correct architectural cut (pure logic vs runtime IO).

### Symbols moved (final scope)

| Source file (deleted) | Symbol | Now lives in |
|---|---|---|
| `generate-program/prompt.ts` | `buildProgramPrompt`, `capCatalog`, `getEquipmentValues`, `getExerciseBounds` | `_shared/programDraft.ts` |
| `generate-program/prompt.ts` | types: `CatalogExercise`, `ProgramConstraints`, `RecentExercise`, `UserProfile` | `_shared/programDraft.ts` |
| `generate-program/validate.ts` | `validateProgram`, types `CatalogEntry`, `ValidatedDay`, `ValidateProgramResult` | `_shared/programDraft.ts` |
| `generate-program/types.ts` | `ProgramDay`, `GenerateProgramResponse` | `_shared/programDraft.ts` |
| `generate-program/gemini.ts` | `callGeminiProgram` | `_shared/programGemini.ts` |

All 4 source files **deleted**. `generate-program/` now contains only `index.ts` — independently deletable post-T129 (#342) without code-motion coordination.

### Bonus refactor (Phase 4 — captured under green tests)

`_shared/programCatalog.ts` previously duplicated `CatalogExercise`, `UserProfile`, `RecentExercise` types verbatim, with a comment justifying the duplication as "avoiding a dependency on a feature module that #343 will retire." That justification became false the moment those types moved into `_shared/`. Deduped: `programCatalog.ts` now re-exports the types from `programDraft.ts` instead of redeclaring them. Single source of truth.

### Import sites updated (6 total)

| File | Change |
|---|---|
| `embedded-agent/draft.ts` | 3 imports from `../generate-program/{prompt,validate,types}` → 1 import from `../_shared/programDraft.ts` |
| `embedded-agent/draft_test.ts` | 2 type imports from `../generate-program/*` → 1 from `../_shared/programDraft.ts` |
| `embedded-agent/index.ts` | `callGeminiProgram` from `../generate-program/gemini.ts` → from `../_shared/programGemini.ts` |
| `generate-program/index.ts` | local imports → `../_shared/programDraft.ts` + `../_shared/programGemini.ts` |
| `src/test/validate-program.test.ts` (vitest) | imports from `../../supabase/functions/generate-program/{validate,types}` → `../../supabase/functions/_shared/programDraft` |
| `src/test/prompt-program.test.ts` (vitest) | imports from `../../supabase/functions/generate-program/prompt` → `../../supabase/functions/_shared/programDraft` |

### Tests

No test code is moved — the existing tests (`embedded-agent/draft_test.ts`, `src/test/validate-program.test.ts`, `src/test/prompt-program.test.ts`) serve as the green-baseline safety net. They keep passing after import flips because behavior is unchanged.

## Out of Scope

- Deleting `supabase/functions/generate-program/index.ts` (still serves the legacy AI program creation route until #343's cutover ticket lands; killed in #342's T129 conditional cleanup).
- Any behavioral change — pure code motion + dedup.

## Acceptance Criteria

- [x] `supabase/functions/_shared/programDraft.ts` exists; exports `buildProgramPrompt`, `capCatalog`, `getEquipmentValues`, `getExerciseBounds`, `validateProgram` + types (`CatalogExercise`, `UserProfile`, `RecentExercise`, `ProgramConstraints`, `CatalogEntry`, `ValidatedDay`, `ValidateProgramResult`, `ProgramDay`, `GenerateProgramResponse`).
- [x] `supabase/functions/_shared/programGemini.ts` exists; exports `callGeminiProgram`.
- [x] `supabase/functions/embedded-agent/{draft,draft_test,index}.ts` no longer imports from `../generate-program/*` (verified: `rg "from \"\.\./generate-program" supabase/functions/embedded-agent/` returns empty).
- [x] `supabase/functions/generate-program/{prompt,validate,gemini,types}.ts` deleted; only `index.ts` remains.
- [x] `_shared/programCatalog.ts` re-exports its catalog/profile types from `programDraft.ts` (deduped — single source of truth).
- [x] All 244 Deno tests (`deno test "supabase/functions/**/*_test.ts"`) pass unchanged.
- [x] All 34 vitest tests touching the moved code (`src/test/{validate,prompt}-program.test.ts`) pass unchanged.
- [x] `deno check supabase/functions/{embedded-agent,generate-program,generate-quick-workout}/index.ts` clean.
- [x] `npx tsc --noEmit -p tsconfig.app.json` clean.
- [ ] `e2e/onboarding.spec.ts` passes (deferred — verified on PR CI).
- [ ] `e2e/quick-workout-ai.spec.ts` passes (deferred — verified on PR CI).

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Sequencing with #342)
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Critical Constraints — T0 preliminary refactor)
- Companion Tech Plan: `docs/Tech_Plan_—_Quick_Workout_AI_to_Embedded_Agent_+_MCP_#342.md`
- Source files: `file:supabase/functions/embedded-agent/draft.ts:25-26`, `file:supabase/functions/generate-program/prompt.ts`, `file:supabase/functions/generate-program/validate.ts`
