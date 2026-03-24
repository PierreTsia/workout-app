# Epic Brief — Duration-Based Exercises & Set Timer

## Summary

Introduce a first-class **measurement mode** for exercises: **reps + load** (today's default) vs **duration** (time-under-tension for holds, planks, wall sits, etc.). The builder and live session stop forcing "reps" where time is the meaningful variable. For duration exercises, each set is paired with an **auto-validating countdown timer** — the user starts the hold, the timer counts down and **auto-completes with haptic/sound feedback** when the target is reached, logging the set with zero extra taps. An **AI-assisted batch script** (same operational pattern as `file:scripts/enrich-difficulty.ts`) classifies the **600+ production exercises** into rep-based vs duration-based. A simple **product-level default** (e.g. 30 s) is applied to all duration exercises; the user can override this once per exercise in the Builder. Session summaries and history surfaces **show duration** where applicable, not misleading "rep" counts.

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
| Classify production exercises | **≥ 95%** of catalog rows have a non-null `measurement_type` after running the enrichment script |
| Auto-validating per-set timer | For duration mode, countdown reaches target → haptic/sound → "Set done?" → auto-log; **manual override** available (end early / extend) but not the primary path |
| Builder + session UX | Builder shows duration-oriented default (editable); session renders countdown timer instead of reps input |
| Honest summaries | Session summary and history rows show **time** (e.g. `45s` / `1:00`) for duration sets, not fake reps |
| Auditable AI run | Script outputs a **CSV audit** with classification and reasoning; **dry-run** and **--force** semantics consistent with `file:scripts/enrich-difficulty.ts` |

---

## Key Design Decisions (settled in brief)

### 1. Separate columns, not overloaded `reps_logged`

`set_logs` gets a new **nullable** `duration_seconds` (integer) column alongside existing `reps_logged`:

- **Reps exercise:** `reps_logged` filled, `duration_seconds` = NULL
- **Duration exercise:** `duration_seconds` filled, `reps_logged` = NULL

This is the only clean path for SQL aggregates, charts, and future analytics. Overloading `reps_logged` with time strings would corrupt every existing history/stats query.

### 2. Auto-validating timer, not Start → Stop → Save

The per-set timer flow for duration exercises:

1. User taps **Start** — countdown begins from target duration (e.g. 30 s).
2. Timer reaches zero → **haptic vibration + sound** → prompt: "Set terminé ?"
3. User taps **Confirm** (or it auto-confirms after brief delay) → set logged with `duration_seconds`.
4. **Override paths** (not primary): tap to end early (logs actual time), tap to extend, or manual MM:SS entry after the fact.

One tap to start, one tap (or zero) to confirm. No "Stop" button in the happy path.

### 3. AI script classifies only — no hold-time proposals

The enrichment script's **only job** is the binary classification: `reps` vs `duration`. It does **not** propose per-exercise or per-tier default hold times — that's too subjective and unreliable for an LLM to get right across 600+ exercises.

Instead: a **single product-level default** (e.g. **30 s**) is applied to all newly-classified duration exercises. The user can edit this value **once per exercise in the Builder**, and that override persists. Simple, auditable, user-controlled.

---

## Scope

**In scope:**

1. **Data model** — Add `measurement_type` (text, `'reps'` | `'duration'`, default `'reps'`) to `exercises` table. Add nullable `duration_seconds` (integer) to `set_logs` — mutually exclusive with `reps_logged`. Add `default_duration_seconds` (integer, nullable) to `exercises` for the Builder default. Extend `WorkoutExercise` with duration target for templates. Supabase migration + `file:src/types/database.ts` updates.
2. **Client session state** — Extend `setsData` (see `file:src/store/atoms.ts` / `SetsTable`) so each row can represent **duration mode** and logged seconds; sync payloads in `file:src/lib/syncService.ts` updated accordingly.
3. **Builder UI** — Where exercises are edited (templates using `WorkoutExercise`), **conditionally render**: reps + weight + RIR when `reps` mode; **duration target** (editable, defaults to `default_duration_seconds` or 30 s) when duration mode. Preserve existing behavior for reps-only exercises.
4. **In-session UI — auto-validating timer** — For duration exercises: countdown from target, haptic/sound on completion, "Set done?" auto-log flow. Manual override for early stop / extend. Respect global workout pause rules already used in `SetsTable`. Large tap targets, one-hand usable during a hold.
5. **Session summary & history** — `file:src/components/workout/SessionSummary.tsx`, `file:src/components/history/SessionRow.tsx`, and related formatters show **duration** for duration sets; no misleading "× reps" for holds.
6. **AI classification script** — New script under `scripts/` (e.g. `scripts/enrich-measurement-type.ts`) using the same env pattern as `file:scripts/enrich-difficulty.ts` (GROQ, Supabase service role, dry-run, audit CSV, idempotent). **Scope limited to binary classification** (reps vs duration) with confidence/reasoning in CSV. Does **not** propose hold times. Sets `default_duration_seconds` to the product constant (30 s) for all duration-classified exercises.
7. **Spot-check** — Top-N exercises manually reviewed post-run (same spirit as difficulty instruction spot-checks).
8. **Types & migrations** — Supabase migrations + `file:src/types/database.ts` updates; RLS/policy review if new columns are user-visible only through existing APIs.

**Out of scope:**

- Replacing **rest timer** or **global session timer** (`SessionTimerChip`, pause semantics) — reuse existing rules; only add per-set duration UX.
- Full **video / audio** guided timed workouts.
- **Per-exercise** custom timer sounds or metronome.
- AI-proposed **per-exercise or per-tier hold times** — the script classifies; the user sets duration targets.
- Changing **AI workout generator** / **program generator** prompts in the same ticket (downstream once catalog is tagged).

---

## Success Criteria

- **Numeric:** After running the enrichment script (non–dry-run), **≥ 95%** of exercises have a defined `measurement_type`; duration exercises have `default_duration_seconds` set to the product constant.
- **Qualitative:** A **plank**-style exercise shows **duration countdown** in session, not a reps field; **bench press**-style exercises unchanged.
- **Qualitative:** Completing a duration set: countdown → haptic → auto-log. Appears correctly in **session summary** and **history** rows as time, not reps.
- **Qualitative:** Per-set timer is **usable with one hand** during a hold (large tap targets, readable, respects workout pause).
- **Qualitative:** Script is **safe to re-run** (idempotent, auditable CSV, dry-run).

---

## Dependencies

- **Exercise Difficulty Levels (done):** `difficulty_level` on `Exercise` exists but is **not consumed by the classification script** — script only answers reps vs duration. **Epic:** `file:docs/done/Epic_Brief_—_Exercise_Difficulty_Levels.md`.
- **Session active duration (done / unrelated):** `sessions.active_duration_ms` does not replace set-level duration; no merge of concepts. **Reference:** `file:docs/Tech_Plan_—_Session_Duration_Excludes_Pause.md`.
- **Reference implementation for scripts:** `file:scripts/enrich-difficulty.ts` (Groq, CSV audit, dry-run, `--force`).

---

## Open questions (for Tech Plan)

1. **Builder template storage:** Should `WorkoutExercise` store a per-template `target_duration_seconds` (overriding the exercise default), or always read from `exercises.default_duration_seconds`?
2. **AI script target:** Run against **production** only via service role (with ops review), or **staging** export first — ops decision.
3. **Auto-confirm delay:** Should the "Set done?" prompt auto-confirm after N seconds of no interaction, or always require a tap? UX tradeoff: zero-friction vs accidental logs.
4. **Issue #134 acceptance criteria** mention "Planche" — likely **Plank**-style holds; **planche** is a distinct exercise — confirm copy in tickets.

---

## References

- GitHub issue: [feat(workout): support duration-based exercises (e.g., Planks) #134](https://github.com/PierreTsia/workout-app/issues/134)
- Code: `file:src/types/database.ts` (`Exercise`, `WorkoutExercise`, `SetLog`)
- Code: `file:src/components/workout/SetsTable.tsx`, `file:src/lib/syncService.ts`
