# T40 — Library Page Redesign

## Goal

Collapse the Library page's 3-tab layout into a unified program list view. This is the first step of the AI-Powered Program Generation epic — a standalone UI improvement that ships as PR A, independently of the AI engine. The simplified Library becomes the foundation for the creation wizard (T44) and AI integration (T45—T48).

## Dependencies

None. This is the entry point for the epic.

## Scope

### Tab removal & layout change

Remove the `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` wrapper from `file:src/pages/LibraryPage.tsx`. Inline the content of `file:src/components/library/MyWorkoutsTab.tsx` directly into the page (program list + "Nouveau programme" CTA + archived toggle + dialogs/sheets).

| Remove | Reason |
|---|---|
| `ProgramsTab` import & tab | Templates move to the creation wizard (T47) |
| `QuickWorkoutTab` import & tab | Already accessible from the side drawer (`file:src/components/SideDrawer.tsx`) |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | No longer needed |

### CTA behavior (unchanged for now)

The "Nouveau programme" button keeps opening `CreateProgramDialog` (blank program flow). The switch to `/create-program` navigation happens in T48.

### Session guard

Disable the "Nouveau programme" CTA when `sessionAtom.isActive` is true. Show a tooltip: "Finish your workout first" (same pattern as the activate button in `ActivateConfirmDialog`).

### i18n cleanup

| File | Changes |
|---|---|
| `file:src/locales/en/library.json` | Remove `tabPrograms`, `tabQuickWorkout`, `quickWorkoutTitle`, `quickWorkoutDescription` keys |
| `file:src/locales/fr/library.json` | Same removals |

## Out of Scope

- Creation wizard route and components (T44)
- AI generation (T41—T46)
- Template relocation into wizard (T47)
- Changing `CreateProgramDialog` behavior

## Acceptance Criteria

- [ ] Library page shows a flat program list (no tabs)
- [ ] "Nouveau programme" CTA opens `CreateProgramDialog` (existing behavior preserved)
- [ ] CTA is disabled with tooltip when a workout session is active
- [ ] Archived toggle shows/hides archived programs
- [ ] `ProgramsTab` and `QuickWorkoutTab` components are no longer imported
- [ ] Removed i18n keys do not appear in EN or FR library files
- [ ] No regressions: program cards, detail sheet, activate/archive flows all work

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md`
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (PR A section)
