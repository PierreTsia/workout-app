# Epic Brief — Exercise Difficulty Levels

## Summary

Add a difficulty classification (beginner / intermediate / advanced) to every exercise in the library, exposed as a color-coded badge in the exercise search modal with multi-select filter support. An AI-assisted enrichment script bulk-classifies all existing exercises based on form complexity, strength requirements, and mobility demands. This is a foundational data layer for future program generation (Onboarding epic) and gamification features.

---

## Context & Problem

**Who is affected:** All users browsing exercises in the "Ajouter un exercice" modal, and (eventually) the program generation system that matches exercises to user profiles.

**Current state:**

- ~600 exercises in the `exercises` table with name, muscle group, equipment, and content (instructions, YouTube, images)
- The exercise search modal (`file:src/components/builder/ExerciseLibraryPicker.tsx`) supports free-text search and filters by muscle group and equipment
- No concept of difficulty — all exercises are presented as equal regardless of skill requirements
- The Onboarding & Program Generation epic (`file:docs/Epic_Brief_—_Onboarding_&_Program_Generation.md`) captures user experience level (beginner/intermediate/advanced) but has no exercise-side difficulty data to match against

**Pain points:**


| Pain                           | Impact                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| No difficulty signal           | Users (especially beginners) can't distinguish a push-up from a muscle-up when browsing exercises |
| No difficulty filter           | Building a beginner-friendly program requires manually knowing which exercises are appropriate    |
| No data for program generation | The future recommendation engine cannot match exercise difficulty to user experience level        |
| Flat exercise list             | The search modal treats all 600 exercises as equally accessible, creating decision fatigue        |


---

## Goals


| Goal                              | Measure                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Classify exercises by difficulty  | >= 95% of exercises have a non-null `difficulty_level` after running the enrichment script                        |
| Expose difficulty in search UI    | Difficulty badge visible on every classified exercise in the search modal                                         |
| Filter by difficulty              | Users can narrow exercise results by one or more difficulty levels via multi-select filter                        |
| Foundation for program generation | Recommendation engine can filter exercises by difficulty matching user experience level (Onboarding epic) and gamification system can leverage tiers |


---

## Tier Definitions

These tiers are a **shared vocabulary** reused by the Onboarding & Program Generation epic (user experience level) and future gamification. The same labels apply to both exercises and users.

| Tier | User Experience | Exercise Characteristics |
|---|---|---|
| **Beginner** | < 6 months regular strength training | Easy to learn, low strength/mobility demands, safe even with imperfect form. E.g., push-up, bodyweight squat, machine leg press. |
| **Intermediate** | 6 months – 2 years | Moderate form complexity, requires a solid strength base, some mobility demands. E.g., barbell bench press, weighted pull-up, Romanian deadlift. |
| **Advanced** | 2+ years consistent training | High form complexity, significant strength and mobility requirements, injury risk if form breaks down. E.g., muscle-up, snatch, handstand push-up. |

---

## Scope

**In scope:**

1. **Schema migration** — Add `difficulty_level` (text, nullable) column to `exercises` with a CHECK constraint restricting values to `'beginner'`, `'intermediate'`, `'advanced'`. Nullable to allow unclassified exercises.
2. **AI classification script** — New script (`scripts/enrich-difficulty.ts`) following the existing Phase 1–3 enrichment pattern. Uses an LLM (Groq or HuggingFace) to classify each exercise based on its name, muscle group, equipment, and instructions. Outputs `difficulty_level` per exercise. Idempotent: only sets difficulty where NULL (unless `--force`). Classifies all exercises including the 23 hand-curated ones (difficulty is new data, not an override of existing content). Must handle rate limits and batch requests with appropriate delays.
3. **Classification audit** — The script outputs a CSV summary (`scripts/data/difficulty-audit.csv`) listing exercise name, assigned difficulty, and the LLM's reasoning snippet. Top 50 most common exercises are manually reviewed post-run, following the existing spot-check pattern (`scripts/spot-check-instructions.ts`).
4. **TypeScript type update** — Add `difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null` to the `Exercise` interface in `file:src/types/database.ts`.
5. **Difficulty badge component** — Color-coded badge (green / yellow / red) displayed on each exercise card in the search modal results. Unclassified exercises show no badge.
6. **Difficulty filter** — Add difficulty as a multi-select filter option in `ExerciseLibraryPicker`, alongside existing muscle group and equipment filters. Consistent with the existing equipment filter UX.
7. **Filter options RPC update** — Extend `get_exercise_filter_options()` to return distinct non-null difficulty levels.

**Out of scope:**

- Per-criteria breakdown columns (form_complexity, strength_req, mobility) — deferred to a potential V2
- Detail view with criteria breakdown on hover (V2)
- Manual review UI for difficulty classifications
- Reclassification based on user feedback
- Difficulty assignment for newly added exercises (known gap: exercises added after the script runs will have `NULL` difficulty until the script is re-run)
- Changes to the onboarding/program generation system (that epic consumes this data independently)
- Changes to the gamification system (not yet specced)

---

## Success Criteria

- **Numeric:** >= 95% of exercises have a non-null `difficulty_level` after enrichment
- **Numeric:** Filter by difficulty returns correct results (exercises without difficulty excluded from difficulty-filtered results)
- **Qualitative:** Difficulty badges are visually scannable with distinct color coding in the dark theme
- **Qualitative:** The enrichment script is idempotent and safe to re-run without overwriting manual corrections

---

## Dependencies

- **Exercise Library (done):** The exercises table is populated with ~600 exercises and content (instructions, muscle group, equipment) for the AI classifier to work meaningfully. This epic is complete.
- **Onboarding & Program Generation (downstream):** That epic will consume `difficulty_level` to match exercise difficulty to user experience level. Does not block this work.
- **Gamification (downstream, not yet specced):** A future gamification system will also leverage difficulty data. Does not block this work.

