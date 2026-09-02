# Epic Brief — Hevy-class Program Builder (#503)

## Summary

This epic turns the **Builder** (`/builder/:programId`) into a Hevy-class authoring canvas: a live day **Body Map** of prospective intent, **Template Prescription** edited in place on solo **Exercise Slots**, and a single **Add** picker that owns catalog solos, **Meet Cindy** seeds, and jetable **Exercise Blocks**. The user sees what a day does to a body and changes 4×8 without a drill-in. GitHub [#503](https://github.com/PierreTsia/workout-app/issues/503) stays the vehicle; AI insight is carved out of this slice (follow-up later). This is not a restyle of the **Program Page** character sheet ([#504](https://github.com/PierreTsia/workout-app/issues/504)) and not a fourth **Embedded Agent** flow.

**Decision record:** `grill-with-docs` + Stitch canvas 27 Aug 2026. ADR `file:docs/adr/0021-builder-one-add-picker.md`. Visual floor: `file:web/stitch/builder-503/`. Glossary: `file:docs/CONTEXT.md`. Hevy UX floor (not a clone): `file:docs/Reference_—_Hevy_Program_Builder.md`. Sibling identity surface: [#504](https://github.com/PierreTsia/workout-app/issues/504). Live score banner: [#519](https://github.com/PierreTsia/workout-app/issues/519).

---

## Context & Problem

**Who is affected:** Post-onboarding athletes who edit a **Program** they own — from the **Program Page**, Library, or Home. No `isAdmin` gate.

**Current state:**
- `file:src/pages/BuilderPage.tsx` is `list` → `editor` → `detail`. **DayEditor** is a CRUD list; tap drills into `ExerciseDetailEditor`.
- `file:src/components/builder/ExerciseRow.tsx` is grip + thumbnail + `muscle · sets×reps @ kg · rest` + always-visible trash. **Template Prescription** is already slot-level (ADR 0006) — the UI just doesn’t let you touch it in place.
- Two page-level add verbs: **Add Exercise** and **Create circuit**. **Meet Cindy** already lives on the picker kind toggle (ADR 0016); ADR 0021 kills the second button and requires the jetable path *inside* **Circuits**.
- Home `WorkoutDayCard` and Quick Workout `PreviewStep` already render a **Body Map**. The screen you *edit* does not.
- The **Program Page** (#504) is the read-only week-as-written sheet. The **Builder** is the write surface. They must not merge.

**Pain points:**

| Pain | Impact |
|---|---|
| Muscle dump as a grey subtitle | 8-second glance fails — you cannot see what the day does to a body while you author |
| Drill-in to change 4×8 | Authoring feels like a CMS; Hevy wins the floor |
| Two equal outline Add buttons + permanent trash | Slow, noisy, fights **Meet Cindy**’s “not a third button” instinct |
| **Body Map** on Home, not on the **Builder** | The viz exists; the job that needs it doesn’t have it |
| Pasting Profil **Équilibre** / `set_logs` here | Answers “what I did,” not “what this day *intends*” |

The original #503 body warned against dropping `SessionHeatmap` on **DayEditor** as a silent “quick win” because that skipped insight. Grilling explicitly skipped insight. The live prospective map *is* the v1 job — not a heatmap of last month’s **Sessions**, and not an AI critique.

---

## User Stories

1. As an **athlete** editing a **workout day**, I want a live front/back **Body Map** plus volume chips that update as I add, remove, or change slots, so that I can see intended muscle load without leaving the canvas.
2. As an **athlete**, I want that map to reflect **Template Prescription** and **Circuit** stations (prospective intent), so that I am not shown last month’s **Sessions** or Profil **Équilibre**.
3. As an **athlete**, I want volume chips to use the same grain as **Program Facts** / **Circuit in Program Scores** (a **Circuit** station is presence, never `rounds ×` stations), so that Cindy does not look like a 50-set pec day.
4. As an **athlete**, I want to edit sets, reps (or duration), weight, and rest on a solo row without opening another screen, so that changing 4×8 is a one-tap job.
5. As an **athlete**, I want ranges, increment, `max_weight_reached`, and instructions behind overflow (`⋯`), so that the row stays dense but engine fields are not deleted.
6. As an **athlete**, I want an **Exercise Block** (user-facing **Circuit**) to stay a grouped card that opens **BlockEditor** for **Per-round Prescription**, so that pyramidal / round grids are not flattened onto the day canvas.
7. As an **athlete**, I want one primary **Add** on the day — not two outline buttons — so that adding work has a single verb (ADR 0021).
8. As an **athlete**, I want the picker kind toggle **Exercises | Circuits**, so that catalog solos and **Benchmark Circuit** seeds stay typed apart (**Meet Cindy**).
9. As an **athlete**, I want to multi-select catalog exercises and confirm **Add N**, so that I can drop several solos in one trip.
10. As an **athlete**, I want tapping a GymLogic seed on **Circuits** to instantiate it on the current day and close the sheet, so that Cindy/Zeus drop stays one tap (`instantiateBenchmark`).
11. As an **athlete**, I want a jetable **Circuit** create path *inside* **Circuits** (not a page-level **Create circuit**), so that custom supersets survive ADR 0021. Chrome (blank-Circuit row vs mode switch) is Tech Plan, not this brief.
12. As an **athlete** searching from **Exercises**, I want `cindy` / seed aliases to pin the WOD card above muscle groups, so that **Meet Cindy** search punch-through is not lost.
13. As an **athlete** in the picker, I want to see which day I am adding to, so that I do not drop work on the wrong day after navigating.
14. As an **athlete**, I want exercises already on the day marked (not double-added as a silent duplicate), so that the picker does not fight the **Unified Day Sequence**.
15. As an **athlete** on an empty day, I want a quiet empty state plus the same **Add**, so that the first stroke is not a blank CMS.
16. As an **athlete**, I want delete on overflow with the existing confirm dialog — not a permanent trash can — so that destructive actions stay deliberate.
17. As an **athlete**, I want drag-reorder of the **Unified Day Sequence** (solos and **Circuits** together) to keep working, so that the canvas does not regress #351.
18. As an **athlete** on the week list, I want each day card to show a mini **Body Map** of that day’s intent, so that I pick a day by what it does to a body, not by a grey subtitle.
19. As an **athlete**, I want day rename, program rename, Activate, and **Saved** in the existing **Builder** header to keep working, so that this epic does not invent a second chrome.
20. As an **athlete** who went offline, I want the existing **Builder** offline block, so that we do not pretend authoring is local-first in v1.
21. As an **athlete** whose mutation fails, I want the existing save-error indicator, so that a failed 4×8 edit is visible.
22. As an **athlete** in FR or EN, I want copy that says **Circuit** never “block”, and never leaks **Exercise Slot** / **Template Prescription**, so that the canvas matches **Program Score Copy** rules.

### Success measures

| Story # | Measure |
|---|---|
| 4 | Changing sets/reps/weight/rest on a solo does not navigate to a `detail` view |
| 7 | Day editor has exactly one primary add CTA |
| 1, 18 | A day with ≥1 slot shows a **Body Map** (editor: live; week list: mini) without an expand-only-to-see-it control as the only path |
| 22 | 0 glossary leaks in shipped `builder` strings (`src/locales/`) |

Stories without a numeric measure are validated qualitatively via the user story itself.

---

## Scope

**In scope:**
- **DayEditor** as hero: live prospective **Body Map** + volume chips; reuse **Body Map** chrome (`file:src/components/body-map/`), not Profil **Équilibre**’s `set_logs` window.
- Week **DayList** mini-maps of each day’s intent (same grain as the editor map).
- Inline slot fields on solo rows; demote `ExerciseDetailEditor` from the `list → editor → detail` stack to overflow (sheet vs drawer is Tech Plan).
- One **Add** picker per ADR 0021: **Exercises | Circuits**; seeds tap-to-drop; jetable create *inside* **Circuits** (path required; widget IA is Tech Plan); no page-level **Create circuit**.
- Delete via `⋯` + existing confirm; hide always-visible trash.
- i18n FR/EN in `builder` (and picker strings already in that namespace).
- Stitch canvas in `file:web/stitch/builder-503/` as visual floor, not a pixel-slave.
- Issue [#503](https://github.com/PierreTsia/workout-app/issues/503) stays the vehicle; this brief is the AI-free slice.

**Out of scope:**
- AI insight / critique / new **Embedded Agent** `purpose` (follow-up; do not smuggle into this restyle). The GitHub title still says “+ AI insight”; that work is not this epic.
- Clone-to-self / fork-before-edit.
- Share / marketplace ([#230](https://github.com/PierreTsia/workout-app/issues/230)).
- Hevy per-set table (ADR 0006).
- Live **Program** score banner while editing ([#519](https://github.com/PierreTsia/workout-app/issues/519)).
- **Program Page** restyle (that’s [#504](https://github.com/PierreTsia/workout-app/issues/504) — week-as-written scores live there, not on the **Builder**).
- Desktop-only two-pane IA (same mobile stack; wide layout may follow the canvas but is not a new product).
- Home / Quick Workout **Body Map** behavior (already shipped).
- **Circuit Catalog** encyclopedia (#483) — still browse, not drop.
- Exact **Circuits** picker chrome for blank Circuit vs seed tap-to-drop (Tech Plan).
- Overflow chrome (sheet vs drawer) for ranges / instructions (Tech Plan).

---

## Success Criteria

- **Numeric:** Day editor exposes exactly one primary add CTA. Solo 4-field edits do not route through `BuilderView = "detail"`.
- **Qualitative:** An athlete can glance at a day, see intended muscle load, change 4×8, and add a movement or a **Circuit** without a CMS list, a second outline button, or a drill-in for the common case. The week list shows the same intent at thumbnail scale.
- **Qualitative:** **Meet Cindy** seed drop and search punch-through still work; jetable **Circuit** authoring still exists, just not as a page-level twin CTA.
- **Negative:** No **Embedded Agent** on this screen. No `set_logs` heatmap pretending to be intent. No **Program** scores on the **Builder** (those live on the **Program Page**).
