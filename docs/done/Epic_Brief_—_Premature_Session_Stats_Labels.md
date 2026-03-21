# Epic Brief — Premature Session Stats & Labels

## Summary

Fix the workout session card (overview carousel) so that stats and date labels accurately reflect the **current state** of each day within the active cycle. Currently, the card conflates past session data with the current plan — showing "Aujourd'hui" and aggregated performance stats even when a session hasn't started, leading to user confusion about what is planned vs. what was actually performed.

---

## Context & Problem

**Who is affected:** Every user landing on the main workout screen and swiping through the day card carousel.

**Current state:**
- `file:src/hooks/useLastSessionForDay.ts` fetches the most recent finished session per day **without cycle scoping** — it pulls data from any past session
- `file:src/components/workout/WorkoutDayCard.tsx` renders a relative date badge (`formatRelativeDate`) and stats (sets, duration) from this unscoped `lastSession`
- `file:src/lib/formatters.ts` uses `Intl.RelativeTimeFormat` with `numeric: "auto"`, producing "Aujourd'hui"/"Today" when the last session was today

**Pain points:**

| Pain | Impact |
|---|---|
| "Aujourd'hui" badge appears on a day that hasn't been started in the current cycle — just because a past session exists | User thinks the day is planned or active today when it isn't |
| Stats (24 sets, 58 min) from old sessions show without "Last" or "Estimate" context | User can't tell if these are template targets or past actuals |
| Exercise count badge is always from template, but sets/duration are from old sessions — mixed sources, no labeling | Cognitive load: is "24 sets" what I should do, or what I did? |
| No visual distinction between plan/estimate and confirmed performance data | Users can't scan-and-compare at a glance |

---

## Goals

| Goal | Measure |
|---|---|
| Context-aware date label | "Aujourd'hui" only appears when a session was finished today in the current cycle |
| Disambiguated stats | Stats are explicitly labeled as "Estimate" (idle) or "Actual" (done) |
| Visual plan vs. reality separation | Estimated stats are visually muted; actual stats are prominent |
| Consistency across carousel | Same logic in WorkoutDayCard, ExerciseListPreview, and any future history views |

---

## Scope

**In scope:**
1. Add cycle-scoping to `useLastSessionForDay` (use existing `cycleId` parameter path from original tech plan)
2. Compute template-based estimated stats (sets, duration) for idle days
3. Context-aware date badge: relative date for cycle-done days, "Last: {date}" for days with only past sessions, hidden when never done
4. Label stats as "Est." or "Actual" with distinct visual treatment
5. i18n keys for new labels (EN/FR)

**Out of scope:**
- Changes to active session UX
- Session summary redesign
- History page changes
- New data model or migrations (all data already exists)

---

## Success Criteria

- **Qualitative:** "Aujourd'hui" label only visible if a session is `active` or `finished` today within the current cycle
- **Qualitative:** Pre-session stats are labeled as "Estimated" with muted styling
- **Qualitative:** User can distinguish between template estimates and real performance data at a glance
- **Qualitative:** Visual hierarchy clearly separates "Plan" from "Reality"
