# Epic Brief — Workout Generator (On-the-fly)

## Summary

This epic adds a "Quick Workout" generator that lets users create a one-off session from three real-time constraints: duration, equipment, and muscle focus. The generator queries the exercise library directly, assembles a balanced workout, and presents an editable preview with a "Regenerate" option before saving. The result is persisted as a single-day program — a reusable entity the user can switch back to anytime. After the session, a lightweight banner guides the user back to their main program. The feature targets the "I don't want to follow my program today" use case with minimal friction: three taps to configure, one tap to generate, optional tweaks, one tap to start.

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
| Minimize time-to-workout for ad-hoc sessions | User can go from "Quick Workout" tap to active session in < 30 seconds (≤ 5 taps happy path) |
| Equipment-aware exercise selection | 100% of generated exercises match the selected equipment category |
| Focus-accurate workouts | All exercises target the selected muscle group (or balanced distribution for Full Body) |
| Duration-appropriate volume | Generated volume (exercises × sets) fits within ±20% of the selected time bracket |
| Reusable generated workouts | Generated workouts persist as single-day programs, switchable from the program list |
| Editable before committing | User can swap/remove exercises, adjust sets/reps, or regenerate entirely from the preview |

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

2. **Exercise selection algorithm** — pure client-side logic, deliberately simple for v1:
   - Query exercises filtered by selected `muscle_group` (or all groups for Full Body) and `equipment` category
   - Volume mapping based on duration:

     | Duration | Exercises | Sets each | Reps | Rest |
     |----------|-----------|-----------|------|------|
     | 15 min   | 3–4       | 3         | 10   | 75s  |
     | 30 min   | 5–6       | 3–4       | 10   | 75s  |
     | 45 min   | 7–8       | 3–4       | 10   | 75s  |
     | 60 min   | 9–10      | 4         | 10   | 75s  |
     | 90 min   | 12–14     | 4–5       | 10   | 75s  |

   - Flat defaults for reps/rest across all exercises (10 reps, 75s rest). Compound/isolation distinction and experience-level filtering deferred to v2 — keeps the algorithm simple and shippable.
   - For Full Body: distribute exercises evenly across major groups (chest, back, legs, shoulders, arms)
   - Randomized selection with variety heuristic (avoid clustering similar movements)
   - **Insufficient exercises fallback:** if the filter combination yields fewer exercises than the duration requires, the generator fills remaining slots from related muscle groups (e.g., secondary muscles or adjacent groups) and shows a notice: "Not enough {focus} exercises for {equipment} — added complementary exercises."

3. **Editable preview** — after generation, the user sees the exercise list with sets/reps/rest and can:
   - **Regenerate** — tap a "Shuffle" button to get a fresh random selection with the same constraints (most important edit action)
   - Remove an exercise (swipe or tap delete)
   - Swap an exercise (opens a filtered exercise picker scoped to the same muscle group + equipment)
   - Adjust sets and rep count per exercise
   - Edit the workout name (defaults to a descriptive label, e.g. "Quick: Chest / Dumbbells / 30min")

4. **Single-day program creation** — confirming the preview:
   - Creates a `programs` row (`name`: user-editable, defaults to "Quick: {Focus} / {Equipment} / {Duration}", `template_id`: null, `is_active`: true)
   - Creates a single `workout_day` under that program
   - Creates `workout_exercises` rows for each exercise with configured sets/reps/rest
   - Deactivates the user's current active program (seamlessly, as part of the "Start Workout" action — no separate confirmation)
   - Stores a reference to the previously active program (in local state) to enable one-tap return

5. **"Back to [program]" banner** — a persistent, lightweight banner at the top of WorkoutPage when the active program is a quick workout (not a modal or dialog). Single tap to switch back. Falls back to the standard change-program flow if the previous program reference is unavailable.

6. **"Quick" badge** — generated single-day programs are visually distinguished in the program list with a "Quick" badge so the user can find and reuse them.

7. **Session integration** — the generated workout is a regular `workout_day`, so rest timer, set logging, PR detection, and session history all work out of the box with no additional wiring.

8. **i18n** — all new UI strings in FR and EN across relevant namespaces.

**Out of scope:**

- Experience-level filtering in exercise selection (v2 — keep algorithm simple for now)
- Compound vs. isolation rep/rest differentiation (v2 — flat defaults for now)
- Saving constraint presets ("my home chest workout" shortcut) — future enhancement
- AI-powered or adaptive exercise recommendations
- Superset / circuit / EMOM generation modes
- Full builder-level editing in the preview (no drag-and-drop reordering, no adding exercises from scratch)
- Scheduling generated workouts for future dates
- Generating multi-day programs from this flow (that's the onboarding wizard's job)

---

## Delivery Phases

**Phase 1 — Core Generator**

- Generator bottom sheet UI with three constraint pill selectors
- Exercise selection algorithm (filter + volume mapping + randomization + insufficient exercises fallback)
- Preview screen with exercise list and "Shuffle" / regenerate button
- Single-day program creation + program switching on confirm
- "Back to [program]" banner on WorkoutPage
- i18n strings

**Phase 2 — Preview Editing & Polish**

- Remove / swap / adjust exercises in preview
- Editable workout name
- "Quick" badge in program list
- Edge case handling (empty states, loading, error recovery)

---

## Success Criteria

- **Numeric:** ≤ 5 taps from "Quick Workout" button to active session (happy path, no edits)
- **Numeric:** 100% of generated exercises match the selected equipment category and muscle group
- **Numeric:** Generated volume fits within ±20% of the selected duration bracket
- **Qualitative:** The preview is clear enough that a user can assess the workout at a glance and make targeted edits without confusion
- **Qualitative:** Switching back to the main program after a generated workout is a single tap via the banner
- **Qualitative:** Generated single-day programs are visible and accessible for reuse from the program switching flow

---

## Dependencies

- **Exercise Library (shipped):** The generator queries the `exercises` table directly. The library already has ~600 exercises with `muscle_group`, `equipment`, `difficulty_level`, and `secondary_muscles` — sufficient coverage for all generator scenarios.
- **Programs abstraction (shipped):** The onboarding epic introduced `programs`, `workout_days` with `program_id`, and the active-program switching infrastructure. The generator creates single-day programs using this existing model.

---

## Resolved Decisions

- **Duration-to-volume mapping:** Ship with current estimates (flat 10 reps, 75s rest), tune based on real usage. The mapping is a configuration concern, not an architectural one.
- **Default equipment:** "Full Gym" is pre-selected by default (most sessions happen at the gym). User can change with one tap.
- **Visual distinction:** Generated single-day programs get a "Quick" badge in the program list.
- **Algorithm simplicity:** v1 uses flat rep/rest defaults and no experience filtering. Compound/isolation heuristics and experience-level adjustments are explicit v2 enhancements.
- **Insufficient exercises:** Generator fills remaining slots from related muscle groups and shows a notice rather than failing or generating a short workout.
