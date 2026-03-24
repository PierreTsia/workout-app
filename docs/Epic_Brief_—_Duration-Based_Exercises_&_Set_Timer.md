# Epic Brief — Duration-Based Exercises & Set Timer

## Summary

Introduce a first-class **measurement mode** for exercises: **reps + load** (today's default) vs **duration** (time-under-tension for holds, planks, wall sits, etc.). The builder and live session stop forcing "reps" where time is the meaningful variable. For duration exercises, each set uses a **countdown timer**: when time is up, **strong haptic + sound** fire, and the user **must tap** a prominent **Terminer / Loguer** button to record the set — **no auto-log** (avoids corrupting stats if the user stopped early). Program templates store **`target_duration_seconds`** on `WorkoutExercise` (nullable → fallback to `exercises.default_duration_seconds`). An **offline-first AI pipeline** classifies exercises from a **local CSV export** (never direct LLM writes to prod); output is audited, then applied via a **reviewed SQL migration**. Session summaries and history show **duration** where applicable, not misleading "rep" counts.

---

## Context & Problem

**Who is affected:** Anyone using the workout builder (`WorkoutExercise` rows in `file:src/types/database.ts`), logging sets in `file:src/components/workout/SetsTable.tsx`, and reviewing history (`SetLog` with `reps_logged`).

**Current state:**

- Every exercise is treated as **rep-based**: `WorkoutExercise.reps` and per-set `reps` in session state; `SetLog.reps_logged` is the persisted record.
- The UI assumes numeric **reps** input for every set; duration-based work (isometrics, timed carries) is a poor fit and confuses users.
- Production has **600+ exercises**; manually tagging each as duration vs reps is not feasible without tooling.
- **Exercise difficulty** (`difficulty_level`: beginner / intermediate / advanced) already exists but is **not relevant to the AI script's job** here — the script only needs to answer "reps or duration?", not propose hold times per tier.
- **Session-level** active duration (`sessions.active_duration_ms`) and **set-level** duration are different concerns: the former is "how long was the workout"; this epic is "how long was *this hold / set*."

**Pain points:**

| Pain | Impact |
| --- | --- |
| Reps-only mental model | Users fake "reps" or abandon logging for planks, wall sits, etc. |
| No per-set timer | Users use external timers; the app doesn't support the actual workflow |
| No bulk classification | Without a script, prod data stays uniformly "rep" until manual fixes |
| Misleading history | Summaries and rows imply "reps" when the work was time-based |

---

## Goals

| Goal | Measure |
| --- | --- |
| Model duration vs reps at exercise + set level | Schema uses **separate columns** (`reps_logged` vs `duration_seconds`) — no overloading; clean stats and aggregates |
| Classify production exercises | **≥ 95%** of catalog rows have a non-null `measurement_type` after the enrichment pipeline |
| Per-set timer + honest log | Countdown → **strong haptic + sound** at zero → user **always taps** to log; logs **actual** duration (early stop supported) |
| Builder + program flexibility | `WorkoutExercise.target_duration_seconds` overrides exercise default when set; **NULL** falls back to `exercises.default_duration_seconds` |
| Honest summaries | Session summary and history rows show **time** for duration sets, not fake reps |
| Safe AI pipeline | **Export → local script → audit CSV → human review → SQL migration** — no LLM direct write to prod |

---

## Key Design Decisions (settled in brief)

### 1. Separate columns, not overloaded `reps_logged`

`set_logs` gets a new **nullable** `duration_seconds` (integer) column alongside existing `reps_logged`:

- **Reps exercise:** `reps_logged` filled, `duration_seconds` = NULL
- **Duration exercise:** `duration_seconds` filled, `reps_logged` = NULL

This is the only clean path for SQL aggregates, charts, and future analytics. Overloading `reps_logged` with time strings would corrupt every existing history/stats query.

### 2. Timer completes with feedback — log only on explicit tap (no auto-log)

The per-set timer flow for duration exercises:

1. User taps **Start** — countdown begins from the target (from `WorkoutExercise.target_duration_seconds` or exercise default).
2. Timer reaches zero → **strong haptic + sound** (user notices even in a hold).
3. User taps a **large** **Terminer** / **Loguer** (or equivalent) — **only then** is the set persisted with `duration_seconds` (typically the target; or actual elapsed if they tapped "end early" before zero).
4. **Early stop:** user can end before zero — log **actual** seconds, not the planned target (avoids a "1 min badge" when they collapsed at 45 s).

**No auto-log, no auto-confirm delay.** Automation would eventually log a duration the user did not earn; explicit completion is also a retention-positive "check the box" moment.

### 3. `WorkoutExercise.target_duration_seconds` (nullable)

Add **`target_duration_seconds`** on `WorkoutExercise` (the row that links an exercise to a program day / template).

- **If NOT NULL:** use this as the session countdown target (e.g. template "Core Strength" forces a **60 s** plank even when `exercises.default_duration_seconds` is 30).
- **If NULL:** resolve from **`exercises.default_duration_seconds`** (and product fallback, e.g. 30 s).

Best of both worlds: catalog default + per-program overrides.

### 4. AI classification pipeline — staging / export only, never direct prod write

Do **not** point the LLM at production with service-role writes. Process:

1. **Export** the exercise catalog to **CSV** (from staging or local snapshot).
2. Run the **classification script locally** against that file (Groq / etc.) → **audit CSV** (classification + reasoning).
3. **Manual validation** of the audit (spot-checks, edge cases).
4. Generate a **SQL migration** (`UPDATE exercises SET … WHERE id = …`) and apply to prod **after review** — same safety as any schema/data change.

Slower than one-shot API writes, but avoids corrupting **600+** rows on a single model hallucination.

### 5. AI script classifies only — no hold-time proposals

The script's **only job** is binary classification: `reps` vs `duration`. It does **not** propose per-exercise hold times.

A **single product-level default** (e.g. **30 s**) applies to newly classified duration exercises in the generated SQL / app defaults. Users refine **`default_duration_seconds`** on the exercise and **`target_duration_seconds`** on program rows in the Builder.

### 6. Catalog naming: **Plank** vs **Planche** (strict separation)

| Term | Meaning | Audience |
| --- | --- | --- |
| **Plank** (e.g. label: gainage / abdominal hold) | Classic **front hold** — abs, accessible | Beginner / intermediate |
| **Planche** (calisthenics) | Advanced straight-body **horizontal** hold on hands — shoulders, balance, very technical | Advanced only |

They must **not** be conflated in the catalog: different movement profiles and user expectations. Use **"Plank"** (or localized equivalent + clear subtitle) for the common hold; keep **"Planche"** as a **separate** advanced exercise entry. Applies to seeds, translations, and search — not only issue #134 wording.

---

## Scope

**In scope:**

1. **Data model** — `exercises`: `measurement_type` (`'reps'` \| `'duration'`, default `'reps'`), `default_duration_seconds` (nullable). `set_logs`: nullable `duration_seconds`, mutually exclusive with `reps_logged`. **`WorkoutExercise`:** nullable **`target_duration_seconds`** (NULL → use `exercises.default_duration_seconds`). Supabase migrations + `file:src/types/database.ts` updates.
2. **Client session state** — Extend `setsData` / `SetsTable` for duration mode and logged seconds; `file:src/lib/syncService.ts` payloads updated.
3. **Builder UI** — Reps + weight + RIR vs duration target; **`target_duration_seconds`** on template row when applicable; fallback behavior documented in UI copy.
4. **In-session UI** — Countdown, strong haptic + sound at zero, **large** log button, **no auto-log**; early-stop logs actual elapsed time. Respect global workout pause rules.
5. **Session summary & history** — Duration shown for duration sets; no fake "× reps" for holds.
6. **AI classification script** — Runs on **exported CSV**; outputs audit CSV; **does not** connect to prod for writes. Follow-up: **SQL** `UPDATE` migration generated and applied after human review.
7. **Spot-check** — Top-N exercises manually reviewed post-classification (same spirit as difficulty spot-checks).
8. **Types & migrations** — RLS/policy review as needed.

**Out of scope:**

- **Direct LLM → production** database writes for classification.
- Replacing **rest timer** or **global session timer** — reuse existing rules.
- Full **video / audio** guided timed workouts; per-exercise custom sounds (beyond default haptic/sound).
- AI-proposed **per-exercise hold times** — the script classifies only.
- Changing **AI workout generator** / **program generator** prompts in the same ticket (downstream).

---

## Success Criteria

- **Numeric:** After running the full pipeline and applying reviewed SQL, **≥ 95%** of exercises have a defined `measurement_type`; duration rows get sensible defaults.
- **Qualitative:** A **plank**-style exercise shows **duration countdown** in session, not reps; **bench press** unchanged.
- **Qualitative:** Completing a duration set requires **explicit tap** to log; **early stop** yields correct seconds, not the planned target.
- **Qualitative:** **Plank** and **Planche** are not confused in the catalog or UI copy.
- **Qualitative:** No production data mutation from the LLM without **audit + migration** in the loop.

---

## Dependencies

- **Exercise Difficulty Levels (done):** `difficulty_level` on `Exercise` — not used by the classification script. **Epic:** `file:docs/done/Epic_Brief_—_Exercise_Difficulty_Levels.md`.
- **Session active duration (done / unrelated):** `sessions.active_duration_ms` vs set-level duration — **Reference:** `file:docs/Tech_Plan_—_Session_Duration_Excludes_Pause.md`.
- **Operational pattern:** `file:scripts/enrich-difficulty.ts` is a **reference** for LLM + CSV audit patterns; **this epic's** classification uses a **stricter** no-direct-prod-write pipeline.

---

## Open questions (for Tech Plan)

1. **Export source:** Staging Supabase project vs `pg_dump` / admin export — pick one for reproducibility.
2. **Localization:** Exact strings for **Plank** / **Planche** in `fr` (and other locales) to avoid search collisions.

---

## References

- GitHub issue: [feat(workout): support duration-based exercises (e.g., Planks) #134](https://github.com/PierreTsia/workout-app/issues/134)
- Code: `file:src/types/database.ts` (`Exercise`, `WorkoutExercise`, `SetLog`)
- Code: `file:src/components/workout/SetsTable.tsx`, `file:src/lib/syncService.ts`
