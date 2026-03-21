# T28 — Onboarding Wizard UI

## Goal

Build the full 5-step onboarding wizard that replaces the Phase 1 placeholder from T25. This is the user-facing centerpiece of the epic: welcome → questionnaire → path choice → template recommendation → program summary → create. Includes all step components, form validation, the page orchestrator, and i18n strings.

## Dependencies

- T25 — Query Refactor, OnboardingGuard & WorkoutPage Empty State (OnboardingGuard, route structure, and placeholder must exist)
- T27 — Recommendation Engine & Program Generation Logic (hooks for templates, ranking, profile creation, and program generation must exist)

## Scope

### Zod Schema

**`file:src/components/onboarding/schema.ts`**
- Validation schema for the questionnaire form
- Required fields: `goal`, `experience`, `equipment`, `training_days_per_week`, `session_duration_minutes`
- Optional fields: `age` (positive integer or empty), `weight` (positive number or empty, in user's display unit)
- `training_days_per_week`: integer 2-6
- `session_duration_minutes`: one of 30, 45, 60, 90

### Step Components

All step components live in `src/components/onboarding/`.

**`WelcomeStep.tsx`**
- Static welcome screen: "Let's build your program"
- App logo, motivational copy
- Props: `onNext()`
- Single CTA button

**`QuestionnaireStep.tsx`**
- React Hook Form + Zod schema
- All profile fields on a single scrollable form (not one-field-per-screen)
- Weight input: reads `weightUnitAtom`, displays label in user's preferred unit (kg/lbs), converts to kg on submit
- Select/radio inputs for goal, experience, equipment, session duration
- Slider or number input for training days per week
- Props: `onNext(profileData: UserProfile)`
- Validation: all required fields must be filled before "Next" is enabled

**`PathChoiceStep.tsx`**
- Two cards: "Recommend me a program" vs "I'll build my own"
- Props: `onGuided()`, `onSelfDirected()`
- Visual emphasis on both as first-class choices (not a primary/secondary pattern)

**`TemplateRecommendationStep.tsx`**
- Calls `useTemplates()` to fetch all templates
- Passes templates + profile to `rankTemplates()` pure function
- Renders ranked cards: template name, description, days/week range, primary goal badge
- Top pick gets a "Recommended" badge
- User taps a card → `onSelect(template)`
- Small "skip" link at bottom → `onSkip()` (creates empty program, same as self-directed)
- Props: `profile: UserProfile`, `onSelect(template: ProgramTemplate)`, `onSkip()`

**`ProgramSummaryStep.tsx`**
- Previews the program that will be generated: for each template_day, shows day label, muscle focus, exercise list with adapted sets/reps
- Read-only in v1 — no inline editing
- "Create Program" button at bottom → `onConfirm()`
- "Back" button → `onBack()`
- Props: `template: ProgramTemplate`, `profile: UserProfile`, `onConfirm()`, `onBack()`

### OnboardingPage (Full Wizard)

Replace the T25 placeholder in `file:src/pages/OnboardingPage.tsx`:

- **Already-onboarded guard:** reads `hasProgramAtom`. If true → `<Navigate to="/" replace />`
- Local state: `{ step: number, profileData: Partial<UserProfile>, selectedTemplate: ProgramTemplate | null }`
- Renders current step component based on `step` value
- Step transitions:
  - Step 1 (Welcome) → `onNext()` → step 2
  - Step 2 (Questionnaire) → `onNext(profileData)` → saves profile via `useCreateUserProfile`, advances to step 3
  - Step 3 (PathChoice) → `onGuided()` → step 4, `onSelfDirected()` → calls `useGenerateProgram(null)` → navigates to `/builder`
  - Step 4 (TemplateRecommendation) → `onSelect(template)` → step 5, `onSkip()` → creates empty program → `/builder`
  - Step 5 (ProgramSummary) → `onConfirm()` → calls `useGenerateProgram(template)` → navigates to `/`
- Full-screen layout, no AppShell — custom minimal header with app logo only

### i18n

- Create `file:src/locales/en/onboarding.json` — English strings for all wizard steps
- Create `file:src/locales/fr/onboarding.json` — French translations
- Add `"onboarding"` to namespace list in `file:src/lib/i18n.ts`
- All user-facing text in step components uses `useTranslation("onboarding")`

## Out of Scope

- Change program flow (T29 — reuses step components from this ticket)
- Analytics event instrumentation (T29)
- Inline exercise editing in ProgramSummaryStep (deferred per epic brief)
- Template seed data (T26) and generation logic (T27)

## Acceptance Criteria

- [ ] Full wizard flow works end-to-end: welcome → questionnaire → path choice → recommendation → summary → create program
- [ ] Self-directed path at step 3 creates an empty program and redirects to `/builder`
- [ ] Guided path generates a program from the selected template and redirects to `/`
- [ ] Skip link on steps 4-5 creates an empty program and redirects to `/builder`
- [ ] Questionnaire validates all required fields via Zod before enabling "Next"
- [ ] Weight input respects `weightUnitAtom` (displays kg or lbs, converts to kg on save)
- [ ] Profile is saved to `user_profiles` via `useCreateUserProfile` on step 2 completion
- [ ] Already-onboarded users navigating to `/onboarding` are redirected to `/`
- [ ] All user-facing strings are translated (EN + FR) via the `onboarding` i18n namespace
- [ ] Wizard is full-screen (no AppShell chrome) with a minimal header

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_&_Program_Generation.md` — Scope item 3 (wizard flow), item 10 (self-directed path)
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_&_Program_Generation.md` — Component Responsibilities (OnboardingPage, QuestionnaireStep, TemplateRecommendationStep, ProgramSummaryStep), Wizard Step Flow diagram, New Files table, Phase 2 steps 8-15
