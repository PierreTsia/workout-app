# Epic Brief — Exercise Content Enrichment

## Summary

This epic enriches the ~575+ imported (Wger) exercises — of ~600 total in the library — with YouTube demo links (Phase 1) and inclusive AI-generated illustrations (Phase 2), via a smart, scalable strategy. The 23 hand-curated exercises keep their existing `youtube_url` and `image_url`; no schema changes. Users get visual form guidance for the majority of the library without brute-forcing 600 API calls or 600 image generations, by prioritization, batching, and optional tiering.

---

## Context & Problem

**Who is affected:** All users building or doing workouts — especially when picking exercises in the Builder or viewing exercise detail mid-workout.

**Current state:**

- The library has grown to ~600 exercises. The 23 hand-curated ones (see file:scripts/exercise-mapping.ts) already have `youtube_url`, `instructions`, and `image_url`; the merge logic preserves them on re-import.
- The remaining ~575+ exercises come from the Wger import (follow-up to [Epic Brief — Exercise Library](Epic_Brief_—_Exercise_Library.md)) and have no YouTube links or illustrations.
- Schema and UI already support content: `exercises` has `youtube_url` and `image_url` (file:src/types/database.ts); file:src/components/exercise/ExerciseInfoDialog.tsx, file:src/components/exercise/ExerciseInstructionsPanel.tsx, and file:src/components/builder/ExerciseLibraryPicker.tsx consume them. Empty values simply show no media.
- The original 24 system exercises are covered by [T18 — Exercise Content & Seed Data](T18_—_Exercise_Content_&_Seed_Data.md) and [Epic Brief — Exercise Demo & Instructions](Epic_Brief_—_Exercise_Demo_&_Instructions.md). This epic targets **imported (Wger) exercises only**.

**Pain points:**


| Pain                                     | Impact                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Most exercises have no visual guidance   | Users cannot learn form in-app for the bulk of the library                                |
| Picker and detail feel incomplete        | Empty thumbnails and no demo link for ~575+ exercises                                     |
| Current illustrations skew non-inclusive | Existing 23 use imagery that is not representative of diverse users                       |
| Scale makes brute-force impractical      | 600 YouTube API searches and 600 AI-generated images would exhaust quotas, cost, and time |


---

## Goals


| Goal                                         | Measure                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| YouTube coverage for imported exercises      | Target defined by strategy (e.g. ≥80% of Tier 1, or ≥80% of all imported)                                   |
| Illustration coverage for imported exercises | Same — strategy-defined subset with ≥80% having `image_url`                                                 |
| Diversity in illustrations                   | Gender and ethnic balance across the illustrated set (e.g. ~50/50 gender, varied skin tones and body types) |
| No regression on existing 23                 | All 23 hand-curated exercises retain current `youtube_url` and `image_url`                                  |
| Strategy that scales                         | Prioritization, batching, and/or tiering are documentable and repeatable for ~600 and future imports        |


---

## Scope

**In scope:**

1. **Strategy (smart approach for ~600 exercises)**
  The epic defines how we handle scale before implementation:
  - **Prioritization** — Which subset gets full treatment first (e.g. exercises with `youtube_url` IS NULL processed in batches; or by muscle group / equipment; or “top N” by usage if data exists).
  - **Coverage targets** — Whether the 80% applies to “all imported”, “Tier 1 only”, or a defined subset; same for images.
  - **Quota and cost** — YouTube Data API v3 daily quota and fallback (e.g. curated channel allowlist); image generation cost and rate limits for the target N (e.g. 200 vs 600); batching rules.
  - **Deduplication / reuse** — Whether we reuse one illustration or one video for exercise families (e.g. “Bench Press” variants) to reduce volume and cost.
  - **Future runs** — How new exercises (future Wger sync or manual add) get enriched: same script on-demand, scheduled batch, or manual.
2. **Phase 1 — YouTube links**
  Batch script (or scripts) that, for each exercise in the chosen subset, find a high-quality demo video (e.g. via YouTube Data API v3 search and/or a curated channel allowlist), then update `youtube_url` in the database. Idempotent: re-run does not overwrite existing non-null `youtube_url`. Language preference (FR then EN, per T18) is configurable.
3. **Phase 2 — Inclusive illustrations**
  Batch pipeline that generates one illustration per exercise in the chosen subset using an image generation model, with explicit diversity constraints (gender balance, ethnic diversity, consistent art style), uploads to the existing Supabase `exercise-media` bucket, and sets `image_url`. Idempotent: re-run does not overwrite existing non-null `image_url`. Style and prompt strategy are defined in the Tech Plan.
4. **No UI or schema changes** — Only backfilling existing columns; UI already handles nulls.

**Out of scope:**

- Full video embedding or playback in-app (link only)
- User-uploaded exercise media
- Animated illustrations (static only for v1)
- Generated **instructions** (setup, movement, breathing, common_mistakes) for imported exercises — deferred to a later epic
- Schema migrations or new columns

---

## Success Criteria

- **Numeric:** Coverage targets defined by the chosen strategy are met (e.g. ≥80% of Tier 1 or ≥80% of all imported have `youtube_url`; same for `image_url`).
- **Numeric:** The 23 hand-curated exercises are unchanged — no overwrite of their `youtube_url` or `image_url`.
- **Qualitative:** Illustrations reflect gender and ethnic diversity across the illustrated set (e.g. balanced representation, not defaulting to a single demographic).
- **Qualitative:** The strategy is documentable and repeatable — same script or process can be run for new exercises or backfills without ad-hoc steps.

---

## References

- [Epic Brief — Exercise Library](Epic_Brief_—_Exercise_Library.md) — Planned follow-up “Generated instructions & YouTube links” for newly imported exercises; this epic is that follow-up.
- [T18 — Exercise Content & Seed Data](T18_—_Exercise_Content_&_Seed_Data.md) — Original 24 system exercises; scope and media format (e.g. `image_url` as path in `exercise-media`).
- [Epic Brief — Exercise Demo & Instructions](Epic_Brief_—_Exercise_Demo_&_Instructions.md) — Schema and UI for `youtube_url`, `instructions`, `image_url`.
- GitHub Issue [#19](https://github.com/PierreTsia/workout-app/issues/19) — feat: Exercise Content Enrichment — YouTube Links & Inclusive Illustrations.

