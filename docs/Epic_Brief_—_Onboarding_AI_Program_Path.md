# Epic Brief — Onboarding AI Program Path

## Summary

First-time onboarding today forks into **template recommendation** or **blank program** only. AI multi-day program generation already ships for returning users via `file:src/pages/CreateProgramPage.tsx` and `file:supabase/functions/generate-program/index.ts`, but that path is unreachable during `/onboarding`. This epic extends the onboarding wizard so new users get a **third, first-class option**—AI-generated program—by **reusing** the create-program AI steps (`AIConstraintStep`, `AIGeneratingStep`, `AIProgramPreviewStep`) and the same edge pipeline, with onboarding-specific orchestration, analytics, post-success navigation, and E2E coverage.

---

## Context & Problem

**Who is affected:** New users who complete the mandatory questionnaire and choose how to create their first program.

**Current state:**

- `file:src/pages/OnboardingPage.tsx` orchestrates welcome → questionnaire → **two-option** `file:src/components/onboarding/PathChoiceStep.tsx` → either `TemplateRecommendationStep` / `ProgramSummaryStep` + `file:src/hooks/useGenerateProgram.ts`, or self-directed blank via `useGenerateProgram` with `template: null`.
- `file:src/pages/CreateProgramPage.tsx` offers **three** paths via `file:src/components/create-program/PathChoiceStep.tsx`: AI, template, blank. The AI chain is `AIConstraintStep` → `AIGeneratingStep` (`file:src/hooks/useAIGenerateProgram.ts`) → `file:src/components/create-program/AIProgramPreviewStep.tsx` (persists program + days + exercises to Supabase).
- `AIConstraintStep` prefills from `file:src/hooks/useUserProfile.ts` once a `user_profiles` row exists—compatible with onboarding **after** questionnaire submit (`useCreateUserProfile`).

**Pain points:**

| Pain | Impact |
|---|---|
| Best program experience is post-onboarding only | Users must finish onboarding via template or blank, then discover Library → create program → AI |
| Divergent “path choice” UX | Onboarding and create-program mental models differ (2 vs 3 options) |
| Hardcoded success navigation on AI preview | `AIProgramPreviewStep` navigates to `/library` after create; template onboarding lands on `/` — first-time parity requires parameterization |

---

## Goals

| Goal | Measure |
|---|---|
| Parity of creation modes | New users can start an AI-generated program from onboarding without leaving the wizard |
| Maximum reuse | No duplicate AI generation or persistence logic; shared components/hooks from create-program path |
| Observable funnel | Analytics distinguish AI vs template vs blank onboarding paths and new steps |
| Consistent first-run exit | After confirming any onboarding program (template or AI), user lands on the **same** home route as today’s template flow (`/`), unless product explicitly chooses otherwise |
| Resilient AI failures | Reuse `AIGeneratingStep` retry and fallbacks; “pick template” from onboarding routes into existing template recommendation + summary |

---

## Scope

**In scope:**

1. **Path choice (onboarding)** — Extend `file:src/components/onboarding/PathChoiceStep.tsx` (or equivalent) to **three** first-class options aligned with create-program: AI program, pick a template (current guided flow), start blank (current self-directed). Copy under `file:src/locales/*/onboarding.json` (and FR parity).
2. **Orchestration** — Extend `file:src/pages/OnboardingPage.tsx` step state to host: constraints → generating → preview, reusing `AIConstraintStep`, `AIGeneratingStep`, `AIProgramPreviewStep` (or thin wrapper). Preserve existing welcome → questionnaire → path order.
3. **Navigation & API surface** — Add a prop or callback on `AIProgramPreviewStep` (e.g. `onProgramCreated` or `successNavigateTo`) so onboarding passes `/` (or `navigate("/", { replace: true })`) while create-program keeps `/library` behavior.
4. **Analytics** — Extend `STEP_NAMES` / `onboarding_step_completed` in `OnboardingPage` and any new events (e.g. AI constraints submitted, AI program confirmed) so funnels match issue #105 acceptance criteria.
5. **Fallback wiring** — From onboarding, `AIGeneratingStep` “template” fallback transitions to `TemplateRecommendationStep` (not Library); “blank” matches current self-directed behavior.
6. **Tests** — Extend `file:e2e/onboarding.spec.ts` with an AI path smoke test; if CI cannot call Gemini, document/skip per existing project patterns.

**Out of scope:**

- Merging onboarding and create-program `PathChoiceStep` into a single shared component (optional follow-up).
- Redesigning onboarding layout, questionnaire, or template recommendation UX beyond what’s needed for the third path.
- Backend changes to `generate-program` unless discovery shows a gap (reuse expected).

---

## Success Criteria

- **Numeric:** 100% of AI onboarding flows use the same edge function and validation as create-program (no second prompt stack); new analytics events fire for each new step with correct `step_name` / payloads in manual verification.
- **Qualitative:** A new user can complete onboarding with an AI-generated program, see preview + rationale, confirm, and land on home with an active program and builder/session behavior identical to programs created from Library AI flow.

---

## References

- GitHub: [Issue #105 — Onboarding: offer AI-generated program path](https://github.com/PierreTsia/workout-app/issues/105)
- Prior art: `file:docs/done/Epic_Brief_—_Onboarding_&_Program_Generation.md`, `file:docs/done/Epic_Brief_—_AI-Powered_Program_Generation.md`
- Tickets: `file:docs/done/T45_—_AI_Constraint_Wizard_&_Generation_Flow.md`, `file:docs/done/T46_—_AI_Program_Preview_&_Confirm.md`
