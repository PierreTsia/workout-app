# Epic Brief — Quick Workout: Multi-select Equipment & Custom AI Prompt

## Summary

This epic evolves the Quick Workout generator so users can combine equipment types (for example bodyweight and dumbbells) instead of picking a single category, and adds an optional free-text field for AI-generated sessions—matching the Program Generator’s “focus areas” pattern—so preferences like cable emphasis or avoiding jumps flow into the `generate-workout` edge function. It tightens parity between deterministic Quick Generate, AI Quick Generate, and the existing program AI flow while keeping duration and muscle focus behavior unchanged.

---

## Context & Problem

**Who is affected:** Anyone using Quick Workout (`QuickWorkoutSheet`) who trains with mixed setups (home + a few weights, hotel + bands, etc.) or who wants the AI path to respect verbal preferences without abandoning structured constraints.

**Current state:**

- Equipment is a single choice (`equipmentCategory` on `GeneratorConstraints` in `file:src/types/generator.ts`): bodyweight, dumbbells, or full gym. The UI uses mutually exclusive pills in `file:src/components/generator/ConstraintStep.tsx`.
- The deterministic path maps one category to DB `equipment` values via `EQUIPMENT_CATEGORY_MAP` in `file:src/lib/generateWorkout.ts`. The exercise pool hook `file:src/hooks/useExercisesForGenerator.ts` filters on that single category.
- AI Quick Generate calls `file:supabase/functions/generate-workout/index.ts` with `duration`, `equipmentCategory`, and `muscleGroups` only. The prompt in `file:supabase/functions/generate-workout/prompt.ts` lists equipment as a single string; there is no user-authored preference line comparable to program generation’s `focusAreas` in `file:supabase/functions/generate-program/prompt.ts`.
- Program AI already exposes optional `focusAreas` (see `file:src/components/create-program/AIConstraintStep.tsx` and `focusAreas` handling in `file:supabase/functions/generate-program/index.ts`).

**Pain points:**

| Pain | Impact |
|---|---|
| Mutually exclusive equipment | Users with “bodyweight + dumbbells” must misrepresent constraints or run separate sessions |
| AI path ignores verbal preferences | Users cannot steer the model (e.g. cables, no jumping) without leaving Quick Workout |
| Inconsistent with Program AI | Same mental model (“optional hint for the AI”) exists elsewhere but not here |

---

## Goals

| Goal | Measure |
|---|---|
| Equipment reflects real mixed setups | Users can combine **bodyweight** and **dumbbells** via **union** of allowed `equipment` values; **full gym** is **exclusive** (see Product & API decisions) |
| AI respects optional text | When non-empty, `focusAreas` appears in the Gemini prompt and influences selection; empty field preserves current behavior |
| Deterministic + AI stay aligned | Quick Generate and AI Generate use the same constraint model end-to-end (types, validation, catalog filtering) |
| No regression on existing flows | Duration, muscle focus, preview, shuffle, save-as-program, and quotas behave as today unless explicitly extended in Tech Plan |

---

## Scope

**In scope:**

1. **Data model & types** — Extend `GeneratorConstraints` (or equivalent) so equipment is multi-select with at least one option required; define how selected categories map to DB `equipment` values (reuse/align with existing maps in `file:src/lib/generateWorkout.ts` and `file:supabase/functions/generate-workout/prompt.ts`).
2. **Constraint UI** — Replace single-select equipment pills with multi-select toggles in `ConstraintStep`; default remains **full gym only** (exclusive). Tapping bodyweight or dumbbells while full gym is selected exits full-gym mode; tapping full gym clears the other toggles.
3. **Exercise pool & deterministic generation** — Update `useExercisesForGenerator`, `generateWorkout`, and related tests so filtering uses the union of equipment values; preserve adaptive fallback behavior where it still applies (behavior when pool is thin may need explicit rules for multi-select).
4. **Edge function `generate-workout`** — Accept multi-select equipment (serialized shape in Tech Plan: e.g. category array or merged union) and optional **`focusAreas`** (same key as `generate-program`). Enforce **500 characters trimmed** server-side. Extend `buildPrompt` to include user text when present, mirroring `file:supabase/functions/generate-program/prompt.ts`. Update validation/tests (`file:supabase/functions/generate-workout/validate.test.ts`, `prompt.test.ts`).
5. **Client AI hook** — `file:src/hooks/useAIGenerateWorkout.ts`: pass `focusAreas` (optional) in the invoke body; keep error handling and catalog resolution unchanged. Client-side **500-character trimmed** validation for immediate feedback.
6. **Program AI parity (validation only)** — Add the same **500-character trimmed** rule to `file:src/components/create-program/schema.ts` and `file:supabase/functions/generate-program/index.ts` for `focusAreas` so both AI entry points share one contract.
7. **i18n** — New/updated strings in `file:src/locales/en/generator.json` and `file:src/locales/fr/generator.json` (labels, placeholder for optional field, any empty-state hints).

**Out of scope:**

- Changing AI quota semantics or billing
- New equipment *categories* beyond the existing three buckets (unless Tech Plan shows a one-line mapping extension)
- Program Generator UX or flow changes beyond the shared `focusAreas` length validation above
- Onboarding or profile defaults migration (unless multi-select requires a one-time default—call out in Tech Plan if needed)

---

## Success Criteria

- **Qualitative:** User can enable “Poids du corps” and “Haltères” together and both Quick Generate and AI Generate only draw from exercises whose `equipment` is in the combined allowed set (with documented fallback if the pool is too small).
- **Qualitative:** Optional free-text is clearly optional; leaving it blank does not add empty lines to prompts or change counts.
- **Qualitative:** Copy and placement feel consistent with Program AI’s focus field (tone, not necessarily identical layout).
- **Numeric / regression:** Existing automated tests for generator constraints and `generate-workout` are updated and pass; new tests cover multi-select and prompt injection at unit level where feasible.

---

## Product & API decisions (locked)

1. **Full gym vs limited equipment:** **Full gym is exclusive.** Choosing it means “everything in the full-gym bucket” and **clears** bodyweight and dumbbells. Choosing bodyweight and/or dumbbells while full gym is on **removes** full gym; the allowed set is the **union** of DB `equipment` values for the selected limited categories. At least one option is always selected; default remains **full gym only**.

2. **Optional AI text — length:** **500 characters** after trim. Validate on the Quick Workout UI, on `generate-workout`, and (for parity) on program creation schema + `generate-program`. Defense in depth: client for UX, edges for trust.

3. **Optional AI text — API name:** Request body field **`focusAreas`** (same as `file:supabase/functions/generate-program/index.ts`). Prompt wording should mirror program generation (e.g. “The user wants to emphasize: …”).

When you are ready, say **create tech plan** to continue with implementation design.
