# Epic Brief — Missing filter button icon on mobile search input

## Summary

Ensure the exercise search modal ("Ajouter un exercice") shows the filter button on **native mobile** so users can open filters by muscle group and equipment. The icon is currently hidden on real mobile devices (desktop and browser responsive mode are unaffected). This epic covers reproducing the issue on native mobile, investigating root cause (layout, overflow, or real-device rendering), fixing visibility and tap targets, and evaluating whether the filter icon should sit on the left or right of the search input, with a documented decision.

---

## Context & Problem

**Who is affected:** Users adding exercises to a program from a phone or tablet (native mobile).

**Current state:**
- In file:src/components/builder/ExerciseLibraryPicker.tsx, the search input and a filter button (SlidersHorizontal icon) sit in a flex row; the icon is on the right.
- On desktop the filter icon is visible and clickable; on desktop with responsive viewport (browser devtools) the bug does **not** reproduce.
- On native mobile the filter icon is not visible (and therefore not tappable), so users cannot access muscle group or equipment filters.

**Pain points:**

| Pain | Impact |
|------|--------|
| Filter inaccessible on native mobile | Users cannot narrow by muscle group or equipment when adding exercises from a phone/tablet |
| Unknown root cause | Risk of incomplete fix or regressions if we don't investigate |
| UX inconsistency | Desktop vs native mobile behavior diverges for the same modal |

---

## Goals

| Goal | Measure |
|------|--------|
| Filter accessible on native mobile | Icon visible and tappable on real devices (e.g. iOS Safari, Chrome Android) |
| Root cause understood | Findings documented in tech plan or implementation ticket |
| Layout robust | No breakage across viewport sizes |
| Icon position decided | Left vs right evaluated and choice documented with rationale |

---

## Scope

**In scope:**
1. Reproduce the missing filter icon on native mobile (not relying on desktop responsive mode as sufficient).
2. Investigate root cause (e.g. flex/overflow, viewport, cmdk input wrapper behavior on real devices).
3. Fix so the filter icon is visible and tappable on native mobile.
4. Evaluate and decide filter icon position (left vs right of search input) with documented rationale.
5. Verify layout and behavior across viewport sizes (small to large).

**Out of scope:**
- Changes to the filter panel behavior or content.
- Treating desktop-only or responsive-only testing as sufficient validation for this fix.

---

## Success Criteria

- **Qualitative:** Filter icon is visible and tappable on native mobile (e.g. iOS Safari, Chrome Android).
- **Qualitative:** Layout remains correct from small to large viewports.
- **Qualitative:** Decision on icon position (left vs right) is documented with rationale.
