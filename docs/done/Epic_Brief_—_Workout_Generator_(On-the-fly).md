# Epic Brief — Workout Generator (On-the-fly)

## Summary

This epic adds a "Quick Workout" generator that lets users create an ad-hoc session from three real-time constraints: duration, equipment, and muscle focus. The generator queries the exercise library directly, assembles a balanced workout with intensity-aware defaults (compound vs. isolation), and presents it on a launch-ready preview screen. Sessions run against an ephemeral workout day — no program creation, no switching. After the session, the user can optionally save the workout as a reusable program. The feature targets the "I don't want to follow my program today" use case with minimal friction: three taps to configure, one tap to generate, one tap to start.

---

## Context & Problem

**Who is affected:** Any user who wants a quick, constraint-driven workout outside their regular program — whether they're short on time, at home instead of the gym, or want to hit a specific muscle group.

**Current state:**

- Users follow a structured multi-day program generated via onboarding or built manually in the builder
- There is no way to create an ad-hoc session without going through the full builder (add day → pick exercises → configure sets)
- The builder is powerful but slow for the "I have 30 minutes and dumbbells, give me a chest workout" scenario
- No concept of quick/generated workouts — every workout requires deliberate construction

**Pain points:**

| Pain | Impact |
|---|---|
| No quick-generate option | Users default to skipping when short on time or away from their usual setup |
| Builder is overkill for one-off sessions | 5+ taps to manually assemble what could be auto-generated in 1 |
| No equipment-adaptive sessions | A user at home with dumbbells can't quickly get a relevant workout |
| Generated workouts aren't reusable | If built manually, the user must rebuild or remember what they did |

---

## Goals

| Goal | Measure |
|---|---|
| Minimize time-to-workout for ad-hoc sessions | User can go from "Quick Workout" tap to active session in < 20 seconds (≤ 4 taps happy path) |
| Equipment-aware exercise selection | 100% of generated exercises match the selected equipment category (or explicitly widened with notice) |
| Focus-accurate workouts | All exercises target the selected muscle group (or balanced distribution for Full Body) |
| Duration-appropriate volume | Generated volume (exercises × sets) fits within ±20% of the selected time bracket |
| Intensity-aware defaults | Compound exercises get 8–10 reps / 90s rest; isolation exercises get 12–15 reps / 60s rest |
| Opt-in reusability | Users can save a generated workout as a program after the session, without forced persistence |

---

## Scope

**In scope:**

1. **Generator UI** — full-screen bottom sheet triggered from a "Quick Workout" button on the WorkoutPage day selector area. Visible to any user with an active program (post-onboarding). Three constraint inputs using pill selectors:
   - **Duration:** 15 / 30 / 45 / 60 / 90 min (single-select)
   - **Equipment:** Bodyweight / Dumbbells / Full Gym (single-select, Full Gym pre-selected). Maps to exercise table `equipment` values:
     - Bodyweight → `bodyweight`
     - Dumbbells → `dumbbell`
     - Full Gym → `barbell`, `dumbbell`, `machine`, `cables`, and any other equipment type
   - **Focus:** `muscle_group` values from the exercises table (fetched dynamically via `get_exercise_filter_options` RPC) plus a "Full Body" meta-option

2. **Exercise selection algorithm** — pure client-side logic:
   - Query exercises filtered by selected `muscle_group` (or all groups for Full Body) and `equipment` category
   - Volume mapping based on duration:

     | Duration | Exercises | Sets each |
     |----------|-----------|-----------|
     | 15 min   | 3–4       | 3         |
     | 30 min   | 5–6       | 3–4       |
     | 45 min   | 7–8       | 3–4       |
     | 60 min   | 9–10      | 4         |
     | 90 min   | 12–14     | 4–5       |

   - **Compound vs. isolation intensity** — derived from `secondary_muscles` field:
     - Has secondary muscles → compound → 8–10 reps, 90s rest
     - No secondary muscles → isolation → 12–15 reps, 60s rest
   - For Full Body: distribute exercises evenly across major groups (chest, back, legs, shoulders, arms)
   - Randomized selection with variety heuristic (avoid clustering similar movements)
   - **Adaptive fallback** — when the filter combination yields fewer exercises than the duration requires:
     1. Widen the equipment filter first (e.g., add `bodyweight` to a dumbbell-only query)
     2. Show a notice: "Not enough dumbbell exercises for Back — added bodyweight exercises"
     3. Never widen the muscle group — respect the user's focus choice

3. **Preview-as-launch-screen** — after generation, the exercises appear on a screen with a prominent "Start" button at the top. This is not a blocking confirmation step — the user can start in 1 tap or optionally:
   - **Shuffle** — tap to regenerate a fresh random selection with the same constraints
   - Remove an exercise (swipe or tap delete)
   - Swap an exercise (opens a filtered exercise picker scoped to the same muscle group + equipment)
   - Adjust sets and rep count per exercise
   - Edit the workout name (defaults to "Quick: {Focus} / {Equipment} / {Duration}")

4. **Ad-hoc session creation** — tapping "Start" creates:
   - A `workout_day` with `program_id = null` (orphan — not attached to any program)
   - `workout_exercises` rows for each exercise with configured sets/reps/rest
   - A `session` linked to the workout day
   - The user's active program remains untouched — no deactivation, no switching

5. **Opt-in "Save as Program"** — after the session completes, a prompt offers: "Save this workout for later?" If accepted:
   - Creates a `programs` row (`name`: defaults to "Quick: {Focus} / {Equipment} / {Duration}", editable, `template_id`: null)
   - Attaches the orphan `workout_day` to the new program via `program_id`
   - Saved programs get a "Quick" badge in the program list for visual distinction
   - If declined, the workout_day stays orphaned — session history is preserved via `set_logs`, but the workout doesn't clutter the program list

6. **Session integration** — the generated workout is a regular `workout_day`, so rest timer, set logging, PR detection, and session history all work out of the box with no additional wiring.

7. **i18n** — all new UI strings in FR and EN across relevant namespaces.

**Out of scope:**

- Saving constraint presets ("my home chest workout" shortcut) — future enhancement
- Experience-level filtering in exercise selection (v2 — keep algorithm focused on equipment + muscle group for now)
- AI-powered or adaptive exercise recommendations
- Superset / circuit / EMOM generation modes
- Full builder-level editing in the preview (no drag-and-drop reordering, no adding exercises from scratch)
- Scheduling generated workouts for future dates
- Generating multi-day programs from this flow (that's the onboarding wizard's job)

---

## Success Criteria

- **Numeric:** ≤ 4 taps from "Quick Workout" button to active session (happy path, no edits)
- **Numeric:** 100% of generated exercises match the selected equipment category and muscle group (or explicitly widened with user notice)
- **Numeric:** Generated volume fits within ±20% of the selected duration bracket
- **Numeric:** Compound exercises default to 8–10 reps / 90s rest; isolation to 12–15 reps / 60s rest
- **Qualitative:** The preview/launch screen lets the user start immediately or tweak without feeling like a gate
- **Qualitative:** Ad-hoc sessions don't pollute the program list — only explicitly saved workouts appear there
- **Qualitative:** The adaptive fallback produces usable workouts even for narrow filter combinations, with clear communication about what was widened

---

## Dependencies

- **Exercise Library (shipped):** The generator queries the `exercises` table directly. The library already has ~600 exercises with `muscle_group`, `equipment`, `difficulty_level`, and `secondary_muscles` — sufficient coverage for all generator scenarios.
- **Programs abstraction (shipped):** The opt-in "Save as Program" flow uses the existing `programs` + `workout_days` model. The `workout_days.program_id` FK is nullable, enabling orphan days.

---

## Resolved Decisions

- **Duration-to-volume mapping:** Ship with current estimates, tune based on real usage. The mapping is a configuration concern, not an architectural one.
- **Default equipment:** "Full Gym" is pre-selected by default. User can change with one tap.
- **Visual distinction:** Saved quick workouts get a "Quick" badge in the program list.
- **Persistence model:** Ad-hoc by default (orphan workout_day, no program). Opt-in save post-session. No program switching, no "back to" prompt needed.
- **Intensity defaults:** Compound/isolation classification via `secondary_muscles` field — simple, leverages existing data, no maintenance overhead.
- **Adaptive fallback:** Widen equipment first (add bodyweight), never widen muscle group. Notify the user.
