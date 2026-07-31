# ADR 0010 — Localize catalog labels at display time, not in snapshots

- **Status:** Accepted
- **Date:** 2026-07-31
- **Decided in:** grilling session (chat), rejecting PR [#416](https://github.com/PierreTsia/workout-app/pull/416) on issue [#415](https://github.com/PierreTsia/workout-app/issues/415)

## Context

The `exercises` catalog is bilingual for names: `name` (French, `NOT NULL UNIQUE`) plus `name_en`, added in `file:supabase/migrations/20240101000007_add_exercise_library_columns.sql` and populated on all 598 rows. The Wger import was English-first and the French names are the AI-assisted translation, so English is the source data, not a derivative.

Display, however, reads the **Catalog Snapshot** — `name_snapshot` / `muscle_snapshot` / `emoji_snapshot` on `workout_exercises`, and `exercise_name_snapshot` on `set_logs`. Those are written from `exercises.name` by **six** distinct paths (`file:src/lib/programPersistence.ts`, `file:supabase/functions/mcp/lib/programPersistence.ts`, `file:src/hooks/useBuilderMutations.ts` ×3, `file:src/hooks/useGenerateProgram.ts`, `file:src/pages/WorkoutPage.tsx`, `file:src/lib/blockPersistence.ts`). English-speaking users — arriving mostly through **MCP**, where the agent resolves in English and writes English day labels — therefore read French exercise names inside an otherwise English program.

An external contributor proposed fixing this at write time: prefer `name_en` when building the snapshot (PR #416). Three forces made that untenable.

**The write side cannot know the locale.** The language preference is device-local `localStorage` (`localeAtom` in `file:src/store/atoms.ts`, same pattern as `weightUnitAtom`); `user_profiles` has no locale column, and MCP auth (`file:supabase/functions/mcp/lib/auth.ts`) resolves the bearer token and never reads the profile. At the moment `create_program` writes a snapshot, the server has no locale to honor — any write-time choice is a guess, applied to every user.

**Partial coverage guarantees mixed output.** Patching two of the six write paths means an MCP-created day reads "Bench Press" while an exercise added by hand right below it reads "Développé couché" — the exact complaint the issue opened with, relocated rather than resolved.

**Snapshots are historical records.** `exercise_name_snapshot` is copied again into `set_logs` at log time and is what history and trends read. Encoding a display preference into a frozen record means the same exercise carries different labels depending on who created it and when, and past rows can never be corrected.

Meanwhile the data needed for display-time resolution is already on the wire: `SLIM_EXERCISE_SELECT` and `FULL_EXERCISE_SELECT` both include `name_en` (`file:src/lib/exerciseSelects.ts`), and `useWorkoutExercises` embeds the whole catalog row in the same PostgREST query as the session rows (`file:src/hooks/useWorkoutExercises.ts`). `set_logs.exercise_id` is `NOT NULL REFERENCES exercises(id)` with no cascade, so history is joinable and the referenced row cannot vanish underneath it.

## Decision

We will resolve catalog labels **at display time**, from the joined `exercises` row, using the reader's locale — never by localizing what gets written into a **Catalog Snapshot**. No write path is modified. The **Catalog Snapshot** keeps its original role: a last-resort fallback for when the catalog row is unavailable.

The resolution order is `name_en` (when the locale is EN and the value is non-empty) → `name` → `name_snapshot`.

## Consequences

- **Positive:** existing programs and existing history are corrected retroactively, with no migration, no backfill, and no re-save — something no write-time fix can achieve. Zero extra network requests on the session path, so offline behavior is unchanged. All six write paths stay untouched, so there is no partial-coverage failure mode. Snapshots recover their intended meaning.
- **Negative:** every display surface must go through the resolution helper, so the number of touched call sites is larger than a two-line write-time patch. A surface that forgets the helper silently keeps showing French, which is invisible to a French-speaking reviewer.
- **Follow-ups:**
  - Add a locale column to `user_profiles` (alongside `timezone`). `localStorage` remains authoritative for rendering; the profile only seeds a device that has no local value, keeping the boot path synchronous and flash-free.
  - Refactor `groupSessionHistory` (`file:src/lib/sessionHistoryGrouping.ts`) to group and sort on `exercise_id` instead of `exercise_name_snapshot`, which is currently a grouping key, a React key, and the sort criterion. This is an accepted, documented exception to the "nothing changes for French users" guarantee: it also fixes a latent bug where a catalog rename splits one exercise into two history cards.
  - Guard the invisible-failure mode with an exhaustiveness test over `MUSCLE_TAXONOMY` (`file:src/lib/trainingBalance.ts`) asserting a translation key exists in both locales — the current `t(key, { defaultValue: key })` fallback renders raw French silently.
  - Locale-aware ranking in `search_exercises` and `resolve_exercises_batch` (both currently prefer French matches and tiebreak alphabetically on `e.name`) is deferred to a second phase, gated on a one-shot audit script under `scripts/` measuring whether English queries actually mis-resolve. Its MCP consequence — the auth path gaining a profile read — gets its own ADR if and when that phase is committed.
  - Transactional emails (`file:supabase/functions/send-transactional-email/`) are hardcoded English today and are out of scope here; they are the one surface where locale genuinely cannot come from the request, and they need their own issue.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Prefer `name_en` when writing `name_snapshot` (PR #416) | The server doesn't know the reader's locale at write time, so it flips every user — including French ones, since `file:src/lib/programPersistence.ts` also backs `useCreateQuickWorkout`. Covers 2 of 6 write paths, and leaves existing programs untouched forever. |
| Add a parallel `name_en_snapshot` column | Doubles the snapshot family and still freezes a display preference in a historical record; needs a backfill; does nothing for the four unpatched write paths. |
| One-shot migration rewriting existing snapshots to English | Same locale-ignorance problem, but irreversible, and it destroys the French reading for the default audience. |
| Keep locale client-only and localize nothing server-side | Acceptable for v1 display, but a client-only preference can never be backfilled — waiting until a server surface needs it (emails, notifications) means every existing user's choice is lost. |
| Migrate `muscle_group` to English slugs | Cleaner long-term than translating French canonical values at display time, but it touches `file:src/lib/muscleMapping.ts` (BodyMap SVG keys), `file:src/lib/trainingBalance.ts`, and every existing `muscle_snapshot`. Deliberately left open for the Tech Plan rather than settled here. |
