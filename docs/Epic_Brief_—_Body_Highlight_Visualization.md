# Epic Brief — Body Highlight Visualization

## Summary

This epic adds an SVG body map that highlights targeted muscles so users can grasp workout and exercise focus visually instead of parsing text tags alone. It ships in two places: per-exercise surfaces (primary vs secondary emphasis) and an aggregated “session heatmap” that rolls up all exercises in a preview or planned session. Rendering must stay vector-only, respect light/dark theme via design tokens, and degrade to a neutral silhouette when catalog data cannot be mapped—without breaking the host screen.

---

## Context & Problem

**Who is affected:** Anyone choosing or running workouts—especially on mobile—who wants quick confirmation of muscle emphasis before committing time and load.

**Current state:**

- Exercise catalog rows expose `muscle_group` and optional `secondary_muscles` (`file:src/types/database.ts`).
- During a session, `file:src/components/workout/ExerciseDetail.tsx` shows muscle focus as a text badge (`muscle_snapshot`) next to the exercise name.
- Generator flow shows muscle as text in `file:src/components/generator/ExerciseDetailSheet.tsx` (`muscle_group`); preview lists exercises in `file:src/components/generator/PreviewStep.tsx` without a holistic body view.
- Theme is class-based (dark/light); new colors must align with existing CSS variables / Tailwind semantic tokens.

**Pain points:**

| Pain | Impact |
|---|---|
| Muscle focus is text-only | Slower scanning; easy to misread similar labels |
| No “whole workout” muscle picture | Users pick sessions “blind” relative to total body stress |
| No visual primary vs secondary | Secondary contribution is easy to ignore or confuse with primary |

---

## Goals

| Goal | Measure |
|---|---|
| At-a-glance muscle read | Users can name primary target areas from the map alone on a sampled set of exercises (qualitative eval / dogfood) |
| Correct mapping | For exercises with valid taxonomy, highlighted regions match `muscle_group` + `secondary_muscles` from catalog data |
| Aggregated session view | Preview / session summary shows combined emphasis across all exercises in the list without manual mental merge |
| Theme fidelity | Map colors meet WCAG contrast for fills/strokes against `background` / `card` in both themes |
| Performance | No 3D or bitmap assets; first paint of the map component does not add a perceptible jank spike on mid-tier mobile (target: interactive within ~100ms of mount on typical hardware—per issue critique) |

---

## Scope

**In scope:**

1. **Mapping layer** — Single module that maps catalog muscle strings (post–[Issue #66](https://github.com/PierreTsia/workout-app/issues/66) taxonomy) to the SVG regions / muscle ids expected by the chosen body-map implementation. Unknown values → no fill (blank avatar), never throw.
2. **Reusable body map UI** — Presentational component: accepts primary vs secondary sets (or weights), applies distinct fill intensities (e.g. strong vs muted), uses theme tokens for colors.
3. **Exercise detail integration** — Embed the map where users inspect a single exercise with library-backed data: at minimum in-session `ExerciseDetail` (resolve primary/secondary via `useExerciseFromLibrary` + snapshots where needed) and generator `ExerciseDetailSheet` for parity.
4. **Aggregated session / preview integration** — One surface that lists “all exercises in this session” and shows the heatmap: candidates include `PreviewStep` (generated workout) and/or the pre-start workout day view on `WorkoutPage`—exact placement is finalized in the Tech Plan to avoid duplicate competing maps.
5. **Responsive layout** — Map scales down on narrow viewports; does not crowd sets/actions (collapsible block or secondary column pattern acceptable).
6. **i18n-safe** — Muscle labels on the map (if any) go through `react-i18next`; data keys remain stable regardless of display locale.

**Out of scope:**

- 3D models, raster muscle images, or heavy animation frameworks.
- Rewriting the entire exercise taxonomy (tracked under #66); this epic consumes the cleaned taxonomy, it does not replace that work.
- Editing muscle tags in admin (unless already part of #66 deliverables).
- Analytics on “time under tension per muscle region” or recovery scheduling—visualization only.

---

## Success Criteria

- **Numeric:** 100% of integration points render without console errors when `muscle_group` is null, empty, or unmapped; Lighthouse performance category on affected routes does not regress by more than 3 points vs main on the same build (same device profile).
- **Qualitative:** In light and dark mode, primary highlight is visually distinct from secondary; aggregated view intuitively reads as “busier where the session hits more.”
- **Qualitative:** On a 390px-wide viewport, map + critical actions remain usable without horizontal scroll.

---

## Dependencies & risks

- **Hard dependency:** Reliable muscle labels and optional secondaries from [Issue #66 — Audit and validate exercise muscle group tagging](https://github.com/PierreTsia/workout-app/issues/66). Until taxonomy is stable, the mapping layer should be data-driven and covered by tests with fixture strings.
- **Library vs custom:** Issue suggests `react-body-highlighter` or custom SVG; Tech Plan must pick based on bundle size, license, muscle id coverage vs our taxonomy, and theming hooks.

---

## Open questions (for Tech Plan)

1. **Single “session preview” owner** — Prefer one canonical aggregated surface first (generator preview vs workout pre-start) to ship faster, or both in one epic?
2. **Snapshot vs live catalog** — For in-session `WorkoutExercise`, should the map use `muscle_snapshot` only, or prefer library refresh when `useExerciseFromLibrary` returns data (affects historical sessions if catalog changes)?
3. **Heatmap semantics** — Should aggregation be binary (hit / not hit), count-weighted by sets, or presence-only regardless of volume?

When taxonomy and these choices are locked, say **create tech plan** to continue.
