# Epic Brief — Exercise Demo & Instructions

## Summary

This epic enriches every exercise in the library with visual form guidance (curated GIF/image, YouTube link) and structured textual instructions (setup, movement, breathing cues, common mistakes). Content surfaces via an expandable detail section within the existing workout `ExerciseDetail` component, giving users immediate access to proper form guidance mid-workout without leaving their current view. Media is statically hosted in Supabase Storage (no third-party API dependency), and instructions are stored as structured JSONB for flexibility.

---

## Context & Problem

**Who is affected:** All users — especially beginners who risk injury performing unfamiliar exercises, and intermediate users refining form.

**Current state:**
- The `exercises` table (`file:supabase/migrations/20240101000001_create_exercises.sql`) has only: `id`, `name`, `muscle_group`, `emoji`, `is_system`, `created_at` — zero instructional content
- `ExerciseDetail` (`file:src/components/workout/ExerciseDetail.tsx`) shows emoji, name, muscle group badge, last session summary, and sets table — no form guidance
- `ExerciseDetailEditor` in the builder shows the same data in editable form — also no instructions
- Users have no way to learn proper exercise form within the app
- 24 system exercises seeded in French (`file:supabase/seed.sql`)

**Pain points:**

| Pain | Impact |
|---|---|
| No visual form reference | Users must leave the app to look up exercises, breaking workout flow |
| Risk of injury for beginners | No guidance on setup, breathing, or common mistakes |
| No differentiation from a spreadsheet | The app is purely a tracker — adds no educational value |
| Exercise names alone are insufficient | "Oiseau haltères" means nothing to someone unfamiliar with the movement |

---

## Goals

| Goal | Measure |
|---|---|
| Form guidance for every system exercise | 100% of seeded exercises have at least instructions + one visual (GIF/image or YouTube link) |
| Zero-navigation access | Users can view instructions without leaving the workout screen (expandable section, < 1 tap) |
| Structured instructional content | Instructions stored as JSONB with named sections: `setup`, `movement`, `breathing`, `common_mistakes` |
| Mobile-performant media | GIFs/images lazy-loaded; YouTube accessed via thumbnail + external link (no iframe embed) |
| Extensible for future exercises | New exercises added via Exercise Library (#1) can include instructions and media from day one |

---

## Scope

**In scope:**

1. **Schema extension** — Add three nullable columns to `exercises`:
   - `youtube_url` (text) — link to a curated YouTube instructional video
   - `instructions` (JSONB) — structured object with keys: `setup`, `movement`, `breathing`, `common_mistakes` (each a string or array of strings)
   - `image_url` (text) — URL to a curated static GIF or image showing proper form

2. **Static media hosting** — Curated GIF/image files stored in a Supabase Storage bucket (`exercise-media`), publicly accessible. One image per exercise minimum.

3. **Expandable exercise detail UI** — New collapsible section inside the existing `ExerciseDetail` component:
   - Collapsed: subtle "How to perform" hint or info icon
   - Expanded: GIF/image (lazy loaded), instruction sections (setup, movement, breathing, common mistakes), YouTube link as a styled external link (opens in new tab)
   - Smooth expand/collapse animation, mobile-friendly touch targets

4. **Builder view integration** — Read-only instructions preview in `ExerciseDetailEditor` and/or `ExerciseLibraryPicker` so users can check form before adding an exercise to their program

5. **Seed data update** — Populate `youtube_url`, `instructions`, and `image_url` for all 24 system exercises in `supabase/seed.sql`

6. **Fallback behavior** — Graceful UI when any media field is null: hide the relevant section rather than show broken placeholders or empty states

7. **i18n** — Instruction text in French (matching existing exercise names); YouTube links can point to either French or English content (best available)

**Out of scope:**

- User-generated content (uploading custom videos/GIFs) — deferred to a future epic
- Giphy API or any third-party media API integration
- Standalone exercise detail page (`/exercises/:id` route) — instructions live within existing components only
- Exercise library expansion beyond the current 24 (depends on Epic #1)
- AI-powered form analysis or video-based rep counting
- Offline caching of media assets

---

## Success Criteria

- **Numeric:** 100% of the 24 system exercises have populated `instructions` JSONB with all four sections (setup, movement, breathing, common_mistakes)
- **Numeric:** >= 90% of system exercises have a curated `image_url` (GIF or static image)
- **Numeric:** >= 80% of system exercises have a `youtube_url` pointing to a relevant instructional video
- **Qualitative:** A user can expand exercise instructions mid-workout in under 1 second with no layout shift or jank
- **Qualitative:** Instructions are clear enough that a beginner could perform the exercise safely after reading them
- **Qualitative:** Missing media fields degrade gracefully — no broken images, no empty sections, no error states

---

## Dependencies

- **Exercise Library (Issue #1):** This epic enriches the existing `exercises` table. If #1 expands the library significantly, the seed data for instructions/media will need updating. However, this epic ships independently against the current 24 exercises — it does not block on #1.

---

## Open Questions

- **Image sourcing:** Where do we get curated exercise GIFs/images? Options include: royalty-free fitness stock (e.g., Flaticon, Freepik), screenshots from YouTube videos (fair use gray area), or AI-generated illustrations. To be decided during implementation.
- **YouTube link longevity:** YouTube videos get deleted. Should we store a backup channel/search query to facilitate re-linking if a URL dies?
- **Instruction language:** French-only for now (consistent with existing exercise names), but when i18n for exercise content lands, instructions will need translation keys or a separate content table.
- **Builder integration depth:** Should the `ExerciseLibraryPicker` show a mini-preview of instructions (to help users pick exercises), or is that over-engineering for now?
