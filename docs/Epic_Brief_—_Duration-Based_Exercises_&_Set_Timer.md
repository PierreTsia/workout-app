# Epic Brief — Duration-Based Exercises & Set Timer

## Summary

Introduce a first-class **measurement mode** for exercises: **reps + load** (today’s default) vs **duration** (time-under-tension for holds, planks, wall sits, etc.). The builder and live session stop forcing “reps” where time is the meaningful variable. For duration exercises, each set is paired with an **actionable timer** (start / pause / complete) so logging matches how the user actually trains. An **AI-assisted batch script** (same operational pattern as `file:scripts/enrich-difficulty.ts`) classifies the **600+ production exercises** into rep-based vs duration-based, and proposes **sensible default hold times** per difficulty tier (aligned with existing `difficulty_level` on `file:src/types/database.ts`). Session summaries and history surfaces **show duration** where applicable, not misleading “rep” counts.

---

## Context & Problem

**Who is affected:** Anyone using the workout builder (`WorkoutExercise` rows in `file:src/types/database.ts`), logging sets in `file:src/components/workout/SetsTable.tsx`, and reviewing history (`SetLog` with `reps_logged`).

**Current state:**

- Every exercise is treated as **rep-based**: `WorkoutExercise.reps` and per-set `reps` in session state; `SetLog.reps_logged` is the persisted record.
- The UI assumes numeric **reps** input for every set; duration-based work (isometrics, timed carries) is a poor fit and confuses users.
- Production has **600+ exercises**; manually tagging each as duration vs reps is not feasible without tooling.
- **Exercise difficulty** (`difficulty_level`: beginner / intermediate / advanced) already exists for enrichment; default **hold durations** can key off the same tiers (e.g. shorter holds for beginners, longer for advanced) once the script proposes values.
- **Session-level** active duration (`sessions.active_duration_ms`) and **set-level** duration are different concerns: the former is “how long was the workout”; this epic is “how long was *this hold / set*.”

**Pain points:**

| Pain | Impact |
| --- | --- |
| Reps-only mental model | Users fake “reps” or abandon logging for planks, wall sits, etc. |
| No per-set timer | Users use external timers; the app doesn’t support the actual workflow |
| No bulk classification | Without a script, prod data stays uniformly “rep” until manual fixes |
| Misleading history | Summaries and rows imply “reps” when the work was time-based |

---

## Goals

| Goal | Measure |
| --- | --- |
| Model duration vs reps at exercise + set level | Schema and types support a clear mode; no ambiguous overload of `reps` without labeling |
| Classify production exercises | **≥ 95%** of catalog rows have a non-null **measurement mode** (or explicit “reps”) after running the enrichment script; duration candidates flagged with proposed defaults |
| Actionable per-set timer | For duration mode, user can **start** a timer per set, **complete** it, and log duration without manual MM:SS typing as the only path (direct input may remain as override) |
| Builder + session UX | Builder shows duration-oriented defaults/inputs; session `SetsTable` (or successor) matches mode |
| Honest summaries | Session summary and history rows show **time** (e.g. `45s` / `1:00`) for duration sets, not fake reps |
| Auditable AI run | Script outputs a **CSV audit** (like `scripts/data/difficulty-audit.csv`) with classification, reasoning, and proposed durations; **dry-run** and **--force** semantics consistent with `file:scripts/enrich-difficulty.ts` |

---

## Tier-aligned default durations (product guidance)

These are **defaults for the builder** and **seeds for the AI script’s proposals**, not medical advice. Exact numbers can be tuned in the Tech Plan.

| User / exercise tier | Default hold duration (indicative) | Notes |
| --- | --- | --- |
| **Beginner** | ~**30 s** | Shorter holds, easier progression |
| **Intermediate** | ~**60 s** | Common plank / wall sit target |
| **Advanced** | **Exercise-specific or longer** (e.g. **90 s+**, or LLM-proposed from name + instructions) | e.g. L-sit, plank variations; script should not collapse everything to one number |

The **AI script** should use `name`, `name_en`, `muscle_group`, `equipment`, `instructions`, and existing **`difficulty_level`** to propose `default_duration_seconds` (or tiered map) per exercise when mode = duration.

---

## Scope

**In scope:**

1. **Data model** — Add an exercise-level field (e.g. `measurement_type` or equivalent) with values such as **`reps`** | **`duration`**, default **`reps`** for backward compatibility. Extend **program/template** (`WorkoutExercise`) and **logged sets** (`SetLog`) so duration sets store **seconds** (or a clearly documented encoding) without breaking existing rep-based rows. *Exact column names and whether to add a nullable `duration_seconds` vs reuse `reps` with a type flag — delegated to Tech Plan.*
2. **Client session state** — Extend `setsData` (see `file:src/store/atoms.ts` / `SetsTable`) so each row can represent **duration mode** and logged seconds; sync payloads in `file:src/lib/syncService.ts` updated accordingly.
3. **Builder UI** — Where exercises are edited (templates using `WorkoutExercise`), **conditionally render**: reps + weight + RIR when `reps` mode; **duration** target (MM:SS or stepper) when duration mode. Preserve existing behavior for reps-only exercises.
4. **In-session UI** — **Actionable timer per set** for duration exercises: visible countdown or count-up, **start** (respect global workout pause rules already used in `SetsTable`), **complete set** to log; optional manual entry for corrections.
5. **Session summary & history** — `file:src/components/workout/SessionSummary.tsx`, `file:src/components/history/SessionRow.tsx`, and related formatters show **duration** for duration sets; no misleading “× reps” for holds.
6. **AI classification script** — New script under `scripts/` (e.g. `scripts/enrich-measurement-type.ts` or similar) using the same env pattern as `file:scripts/enrich-difficulty.ts` (**GROQ** or project-standard LLM, **Supabase service role**, dry-run, audit CSV, idempotent updates). Goals:
   - Label each exercise as **reps** vs **duration** (with confidence / reasoning in CSV).
   - For **duration** candidates, propose **default duration(s)** per **beginner / intermediate / advanced** (mapping to `difficulty_level` or user profile later).
   - Support **dry-run** and **--force**; **never** silently wipe human overrides if a manual review column is introduced later.
7. **Spot-check** — Top-N exercises manually reviewed post-run (same spirit as difficulty instruction spot-checks).
8. **Types & migrations** — Supabase migrations + `file:src/types/database.ts` updates; RLS/policy review if new columns are user-visible only through existing APIs.

**Out of scope:**

- Replacing **rest timer** or **global session timer** (`SessionTimerChip`, pause semantics) — reuse existing rules; only add **per-set** duration UX.
- **Auto-start** timer on set navigation without user action (may be a follow-up; default is explicit user intent).
- Full **video / audio** guided timed workouts.
- **Per-exercise** custom timer sounds or metronome.
- Changing **AI workout generator** / **program generator** prompts in the same ticket (may be a follow-up once the catalog is tagged; call out as **downstream**).

---

## Success Criteria

- **Numeric:** After running the enrichment script (non–dry-run), **≥ 95%** of exercises have a defined measurement mode; **duration** exercises have proposed defaults in the audit CSV.
- **Qualitative:** A **plank**-style exercise shows **duration** in builder and session, not a reps field; **bench press**-style exercises unchanged.
- **Qualitative:** Completing a duration set logs **time** and appears correctly in **session summary** and **history** rows.
- **Qualitative:** Per-set timer is **usable with one hand** during a hold (large tap targets, readable, respects workout pause).
- **Qualitative:** Script is **safe to re-run** (idempotent, auditable CSV, dry-run).

---

## Dependencies

- **Exercise Difficulty Levels (done):** `difficulty_level` on `Exercise` supports tier-aligned default durations in the script and UI copy. **Epic:** `file:docs/done/Epic_Brief_—_Exercise_Difficulty_Levels.md`.
- **Session active duration (done / unrelated):** `sessions.active_duration_ms` does not replace set-level duration; no merge of concepts. **Reference:** `file:docs/Tech_Plan_—_Session_Duration_Excludes_Pause.md`.
- **Reference implementation for scripts:** `file:scripts/enrich-difficulty.ts` (Groq, CSV audit, dry-run, `--force`).

---

## Open questions (for Tech Plan)

1. **Storage:** Prefer **explicit** `duration_seconds` (or interval) on `set_logs` + flag on exercise vs overloading `reps_logged` with a `"45s"` string — tradeoff: migrations vs query simplicity.
2. **Builder template vs user override:** Should `WorkoutExercise` store **default duration per set** only, or also **tier-aware** defaults when the user’s profile differs from exercise `difficulty_level`?
3. **AI script target:** Run against **production** only via service role (with ops review), or **staging** export first — **ops decision**.
4. **Issue #134 acceptance criteria** mention “Planche” — likely **Plank**-style holds; **planche** is a distinct exercise — confirm copy in tickets.

---

## References

- GitHub issue: [feat(workout): support duration-based exercises (e.g., Planks) #134](https://github.com/PierreTsia/workout-app/issues/134)
- Code: `file:src/types/database.ts` (`Exercise`, `WorkoutExercise`, `SetLog`)
- Code: `file:src/components/workout/SetsTable.tsx`, `file:src/lib/syncService.ts`
