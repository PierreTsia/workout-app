# Epic Brief — Improve Exercise Search Modal UX on Mobile

## Summary

Improve the "Ajouter un exercice" (exercise search) modal so that on mobile—and consistently on desktop—users get a larger, less fragile UX: modal height 70–80% of viewport on mobile, no accidental close on tap-outside, an explicit close (X) in the header, and an explicit "Add" action per exercise row instead of single-tap-to-add. Users can add one exercise at a time or use multi-select (checkboxes + "Add selected") to add several exercises in one go. This reduces accidental exercise selection and accidental modal dismissal while scrolling, and makes adding exercises an intentional action. The same behavior applies across breakpoints (mobile and desktop) for consistency.

---

## Context & Problem

**Who is affected:** Users adding exercises to a program from the workout builder, especially on mobile (320px–768px). The same modal is used on desktop; this epic aligns behavior across viewports.

**Current state:**

- The modal is implemented in file:src/components/builder/ExerciseLibraryPicker.tsx using Radix `Dialog` and cmdk (`Command` / `CommandItem`). It uses `max-h-[80vh]` but on mobile can feel cramped (~50% in practice due to layout).
- Closing is possible via Radix’s default: tapping outside the modal dismisses it, which is easy to do by accident while scrolling the list.
- There is no explicit close button (X) in the header.
- Selecting an exercise is done by tapping the exercise row (`CommandItem` with `onSelect` calling `handleSelect`), which immediately adds the exercise and closes the modal. Scrolling through a long list makes it easy to add the wrong exercise by mistake.
- A separate epic (Epic Brief — Missing filter button icon on mobile search input) addresses filter icon visibility on native mobile for the same modal; that work is independent of this epic.

**Pain points:**

| Pain | Impact |
|------|--------|
| Modal too small on mobile | Cramped layout, search bar and list get minimal space; poor discoverability |
| Accidental close on tap-outside | User loses context and must reopen the modal and re-apply filters/search |
| Single-tap-to-add on row | Wrong exercise added while scrolling; no preview or confirmation; high friction to undo |
| No explicit close control | No clear way to dismiss without risking tap-outside |

---

## Goals

| Goal | Measure |
|------|--------|
| Modal uses more screen on mobile | Height 70–80% of viewport on mobile breakpoints (e.g. 75% as target); search and list clearly visible |
| Dismissal is intentional | Close only via explicit close (X) button; tap-outside does not close modal |
| Add is explicit | Each exercise row has an explicit "Add" control; tapping the row does not add the exercise |
| Consistent UX across viewports | Same close and selection behavior on desktop and mobile (320px–768px+) |
| Clear feedback on add | Visual feedback when an exercise is added (e.g. highlight or state change on the Add action) |
| Multi-select support | Users can select multiple exercises (e.g. checkboxes) and add them in one action ("Add selected") |

---

## Scope

**In scope:**

1. **Modal size on mobile:** Increase effective modal height on mobile so it uses 70–80% of viewport (e.g. 75%); ensure search bar and list are well visible. Desktop can keep or align to the same max-height rules as needed for consistency.
2. **Close behavior:** Remove close-on-click-outside for the exercise search modal. Add an explicit close button (X icon) in the modal header (e.g. top-right). Closing only via X (and any existing escape-key behavior) so dismissal is intentional.
3. **Selection pattern:** Remove single-tap-to-add on the exercise row. Add an explicit "Add" control (e.g. button or icon) per row. Tapping the exercise name/row does not add the exercise; only the Add control adds it. Optional: tapping the row could open a preview (e.g. existing `ExerciseInfoDialog`) without adding.
4. **Multi-select:** Support selecting multiple exercises (e.g. checkboxes per row) and adding them in one action (e.g. "Add selected" button). Selected state is clearly visible; user can add one at a time or batch-add.
5. **Visual feedback:** When the user adds an exercise (or batch), provide clear feedback (e.g. loading state on the Add control, or brief highlight) before the modal closes (if it closes on add).
6. **Breakpoints:** Ensure behavior and layout work across mobile breakpoints (320px–768px) and desktop; one consistent interaction model.

**Out of scope:**

- Changes to filter panel content or filter logic (handled by the filter-button epic).
- Changes to exercise library data or search/filter API.

---

## Success Criteria

- **Numeric/constraint:** Modal height on mobile is at least 70% of viewport (e.g. 75% as implementation target) within 320px–768px.
- **Qualitative:** A close button (X) is present in the modal header (e.g. top-right) and is the primary way to close the modal; tap-outside does not close the modal.
- **Qualitative:** Each exercise row has an explicit "Add" control; tapping the exercise name/row does not add the exercise.
- **Qualitative:** Adding an exercise gives clear visual feedback (e.g. loading or success state on the Add control).
- **Qualitative:** Multi-select is supported: user can select multiple exercises (e.g. checkboxes) and add them in one action; selected state is visible.
- **Qualitative:** Behavior is consistent and usable across 320px–768px and desktop.

---

## References

- GitHub Issue [#32](https://github.com/PierreTsia/workout-app/issues/32) — Improve Exercise Search Modal UX on Mobile.
- Related: [Epic_Brief_—_Missing_filter_button_icon_on_mobile_search_input.md](Epic_Brief_—_Missing_filter_button_icon_on_mobile_search_input.md) — same modal, filter icon visibility on native mobile.
