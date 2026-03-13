# Epic Brief — Exercise Library

## Summary

Populate the exercise library with 200+ exercises sourced from a public API, with AI-assisted French translations, free-text search, and filtering by muscle group and equipment. The 23 existing hand-curated exercises are preserved and enriched via a merge strategy. Data flows through a one-time import script — no cron or live sync. A follow-up task generates instructions and YouTube links for newly imported exercises.

---

## Context & Problem

**Who is affected:** All users building custom workouts via the Builder (T7).

**Current state:**
- 23 hand-curated exercises in `supabase/seed.sql` with French names, instructions, YouTube URLs, and images
- Exercise schema: `id`, `name`, `muscle_group`, `emoji`, `is_system`, `youtube_url`, `instructions`, `image_url` (see file:supabase/migrations/20240101000001_create_exercises.sql)
- No `equipment` column — can't filter by available gym equipment
- No free-text search — file:src/components/builder/ExerciseLibraryPicker.tsx shows a flat, unfiltered list
- Users can only pick from the 23 existing exercises when building programs

**Pain points:**
| Pain | Impact |
|---|---|
| Only 23 exercises available | Users can't build programs with exercises outside Pierre's routine |
| No equipment filter | Users at different gyms can't narrow by what's available to them |
| No search | Scrolling a flat list doesn't scale past ~30 exercises |
| No bilingual support | Exercise names are French-only — no English fallback for search or future i18n |

---

## Goals

| Goal | Measure |
|---|---|
| Expand the exercise library | >= 200 exercises available after import |
| Equipment-based filtering | Users can filter by equipment type (barbell, dumbbell, machine, bodyweight, cable, etc.) |
| Muscle group filtering | Filter by primary muscle group (already partially supported) |
| Free-text search | Users can search exercises by name (FR or EN) |
| French translations | >= 80% of imported exercises have a French name; top 50 manually reviewed |
| Preserve existing content | All 23 existing exercises retain their instructions, YouTube URLs, and images after import |

---

## Scope

**In scope:**
1. **API source evaluation** — Compare Wger API vs Lyfta scraping on data quality, licensing, coverage, and reliability. Produce a short comparison doc and pick one before any implementation begins.
2. **Schema migration** — Add columns to `exercises`:
   - `equipment` (text) — equipment required (e.g. "barbell", "dumbbell", "machine")
   - `name_en` (text, nullable) — original English name for bilingual search and future i18n
   - `source` (text, nullable) — provenance tracker (e.g. "wger", "manual")
   - `secondary_muscles` (text[], nullable) — nice-to-have, not blocking
3. **One-time import script** — Node/TypeScript script that fetches exercises from the chosen API, translates names via OpenAI or DeepL, merges with existing data, and upserts into Supabase.
4. **Deduplication / merge logic** — Match API exercises to existing ones by normalized name or muscle group + name similarity. Keep local enrichments (instructions, YouTube, images), backfill missing fields (equipment, name_en, source) from the API.
5. **AI translation pipeline** — Translate exercise names EN → FR using OpenAI or DeepL at import time. Flag the top ~50 most common exercises for manual review post-import.
6. **Search and filter UI** — Upgrade file:src/components/builder/ExerciseLibraryPicker.tsx with a free-text search input and filter chips for muscle group and equipment.

**Planned follow-up (separate task):**
- **Generated instructions & YouTube links** — For newly imported exercises, generate basic instructions via AI and find best-effort YouTube demo links. Not part of this epic's core deliverables — tracked as a follow-up task once the main import lands.

**Out of scope:**
- Cron / scheduled sync (one-time import only)
- Exercise images from external APIs (Wger has none; Lyfta images are legally unclear)
- ExerciseDB / RapidAPI (paid, skipped for MVP)
- Multi-language beyond FR/EN
- Full standalone "Browse Library" page (search/filter lives inside the picker)

---

## Success Criteria

- **Numeric:** >= 200 exercises in the library after import
- **Numeric:** >= 80% of imported exercises have a French-translated name
- **Qualitative:** Users can find an exercise by typing part of its name in under 2 seconds
- **Qualitative:** Users can narrow results by equipment type and muscle group
- **Qualitative:** The 23 existing exercises are unchanged — instructions, YouTube URLs, and images intact after import
