# T47 — Template Path in Wizard

## Goal

Add the "From Template" path to the creation wizard, reusing existing template browsing components. After this ticket, users can browse the template catalog, preview a template's structure, and create a program from it — all within the full-page wizard experience.

## Dependencies

T44 (wizard shell must exist to host these steps).

## Scope

### Template choice step

`src/components/create-program/TemplateChoiceStep.tsx`:

- Reuses `file:src/components/library/TemplateCard.tsx` for template rendering
- Reuses `file:src/components/library/LibraryFilterBar.tsx` for goal/experience/equipment filters
- Uses `file:src/hooks/useTemplates.ts` for data fetching
- Selecting a template calls `onNext(template)` to transition to preview

### Template preview step

`src/components/create-program/TemplatePreviewStep.tsx`:

- Displays selected template details: name, description, day count
- Day-by-day breakdown showing exercises with name, muscle group, sets, reps, rest
- Reuses DayCard patterns from `file:src/components/library/DayCard.tsx`
- Actions:
  - **Back** — return to template catalog
  - **Create Program** — calls `file:src/hooks/useGenerateProgram.ts` with `{ template, profile, activate: true }`
  - On success: navigate to `/library`

### i18n additions

| Key | EN | FR |
|---|---|---|
| `templateTitle` | Choose a template | Choisissez un modèle |
| `templatePreviewTitle` | Template Preview | Aperçu du modèle |
| `useTemplate` | Use this template | Utiliser ce modèle |
| `noTemplates` | No templates match your filters | Aucun modèle ne correspond |

## Out of Scope

- Template editing or custom template creation
- AI path (T45—T46)
- E2E tests (T48)

## Acceptance Criteria

- [ ] Template catalog displays with filter bar (goal, experience, equipment)
- [ ] Filters work: templates narrow based on selections
- [ ] Selecting a template transitions to preview step
- [ ] Preview shows day-by-day exercise breakdown with volume details
- [ ] "Create Program" uses `useGenerateProgram` with the selected template + user profile
- [ ] Equipment swaps are applied via `resolveEquipmentSwap` (existing pipeline)
- [ ] Experience adaptation is applied via `adaptForExperience` (existing pipeline)
- [ ] On success: user is navigated to `/library`, program is active

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md` (Scope item 2)
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (TemplateChoiceStep, TemplatePreviewStep)
- Existing components: `file:src/components/library/TemplateCard.tsx`, `file:src/components/library/LibraryFilterBar.tsx`
