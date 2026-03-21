# Epic Brief — AI-Powered Program Generation

## Summary

This epic adds AI-powered multi-day program generation and redesigns the Library page into a unified program management view. Today, users choose between rigid templates ("pick and go") or building a program manually from scratch — there is no middle ground. The AI path generates a complete multi-day training program tailored to the user's profile and stated preferences: the LLM designs the split structure and selects exercises, while deterministic code assigns volume (sets, reps, rest) — the same separation of concerns proven in the single-workout AI generator. A single LLM call returns the full program (split with rationale + exercises per day); the UI progressively reveals the split first, then unfolds exercises underneath. A second LLM call only happens if the user modifies the proposed split. The Library's current 3-tab layout collapses into a single program list with a prominent creation wizard offering three paths: AI Generate, From Template, and Start from Scratch. The Quick Workout tab is removed from the Library — it is already accessible from the side drawer.

---

## Context & Problem

**Who is affected:** Any user who wants a structured multi-day program tailored to their goals, experience, and equipment — without the expertise to design one from scratch.

**Current state:**
- The Library page (`file:src/pages/LibraryPage.tsx`) has 3 tabs: "Mon entraînement" (manage programs), "Programmes" (template catalog), "Séance rapide" (quick single sessions)
- Program creation has two extremes: pick a rigid template verbatim via `file:src/components/library/ProgramsTab.tsx`, or build everything manually from a blank slate via `file:src/components/library/CreateProgramDialog.tsx`
- AI generation exists but only for single ad-hoc sessions — `file:supabase/functions/generate-workout/index.ts` returns a flat list of exercise IDs for one workout, not a multi-day program
- Templates are static and limited (6 templates seeded via migrations) — they do not adapt to the user's specific profile beyond equipment swaps and experience-based set/rep adjustments at generation time
- The 3-tab structure fragments the experience: Quick Workout is already accessible from the side drawer, templates and program management are on separate tabs despite being part of the same "create/manage programs" workflow

**Pain points:**

| Pain | Impact |
|---|---|
| No middle ground between "copy a template" and "build from scratch" | Users who want a personalized program must either settle for a generic template or invest significant time in manual design |
| Templates don't adapt their structure to the user | A 3-day user and a 6-day user get the same PPL template — it's the user's job to figure out which days to use |
| AI intelligence is limited to single sessions | The biggest value of AI-driven exercise selection — designing coherent multi-day splits with complementary muscle pairings — is untapped |
| Library UX is fragmented | 3 tabs with overlapping concepts; Quick Workout doesn't belong alongside program management |
| No AI awareness of program-level concerns | Single-session AI can't reason about cross-day exercise distribution, weekly volume balance, or progressive split design |

---

## Goals

| Goal | Measure |
|---|---|
| Context-aware multi-day program generation | AI designs the split structure (day count, muscle focus per day) and selects exercises per day — informed by user profile, goals, and preferences. Deterministic code assigns volume (sets/reps/rest) using the proven `buildExercise` + `adaptForExperience` pipeline. |
| Progressive reveal with user agency | A single LLM call returns the full program. The UI shows the split with rationale first, then unfolds exercises per day. If the user modifies the split, a second call regenerates exercises. Users feel in control without added latency. |
| Sub-10-second generation latency | Full program generation (structure + exercises) completes in < 10s (p95) from submission to preview render |
| Zero hallucination tolerance | 100% of AI-returned exercise IDs exist in the catalog and match equipment/muscle constraints — enforced by per-day server-side validation |
| Unified Library UX | Single program list view with one creation CTA replaces the 3-tab layout. Programs, templates, and quick sessions each have a clear home. |
| Profile-prefilled constraint wizard | Returning users go from "Nouveau programme" to AI preview in under 30 seconds — all known fields prefilled from `user_profiles` |
| Full editability after creation | AI-generated programs are standard `programs` + `workout_days` + `workout_exercises` rows — fully editable in the existing builder, no locked or special-cased fields |

---

## Scope

**In scope:**

1. **Library page redesign** — collapse the 3-tab layout (`file:src/pages/LibraryPage.tsx`) into a single unified view: the user's program list with a prominent "Nouveau programme" CTA at the top. Active program highlighted, inactive programs below, archived toggle at bottom. Remove the Quick Workout tab (`file:src/components/library/QuickWorkoutTab.tsx`) — it is already accessible from the side drawer (`file:src/components/SideDrawer.tsx`). The template catalog (`file:src/components/library/ProgramsTab.tsx`) moves into the creation wizard as one of three paths.

2. **Full-page program creation wizard** — new route (`/create-program`) with a dedicated full-page experience (outside `AppShell`, like `file:src/pages/OnboardingPage.tsx`). Three creation paths:
   - **AI Generate** — constraint wizard → single AI call → progressive reveal (split with rationale, then exercises) → preview → confirm
   - **From Template** — template catalog (reuses `file:src/components/library/TemplateCard.tsx`, `file:src/components/library/LibraryFilterBar.tsx`, and `file:src/components/library/TemplateDetailSheet.tsx` content) → preview → confirm
   - **Start from Scratch** — name input → creates empty program → redirects to builder (existing `file:src/components/library/CreateProgramDialog.tsx` behavior)

3. **AI constraint wizard** — collects program parameters, prefilled from `user_profiles` where available:
   - Training days per week (prefilled from profile)
   - Session duration per day (prefilled from profile)
   - Training goal (prefilled from profile)
   - Experience level (prefilled from profile)
   - Equipment available (prefilled from profile)
   - Optional free-form preferences: focus areas (e.g. "emphasis on upper body"), exercises to include or exclude, split preference (or "let AI decide")

4. **Single-call AI with progressive reveal** — the LLM receives user constraints + a condensed exercise catalog and returns the complete program in one response: split structure (day count, label per day, muscle focus per day, brief rationale) plus exercise IDs per day. The UI reveals results progressively:
   - First: the split structure with the AI's rationale is displayed (day cards with labels and muscle focus).
   - Then: exercises per day unfold underneath each day card.
   - The user can review, expand/collapse days, and decide to accept or modify.
   - If the user modifies the split (changes a day's muscle focus, adds/removes a day), a second LLM call regenerates exercises for the changed structure. If they accept as-is, no second call is needed.
   - This approach minimizes latency (single round-trip in the happy path) while giving the *impression* of a thoughtful two-step process.

5. **`generate-program` Supabase Edge Function** — new edge function, separate from `file:supabase/functions/generate-workout/index.ts`. Receives user constraints + profile + training history. Fetches a pre-filtered exercise catalog from the DB (same pattern as `file:supabase/functions/generate-workout/prompt.ts` — equipment + muscle group filtering, capped catalog). Constructs a program-design prompt for Gemini 2.5 Flash. Returns structured JSON: split structure with rationale + exercise IDs per day. The LLM selects exercises only — volume (sets, reps, rest) is assigned deterministically client-side via `file:src/lib/generateWorkout.ts` (`buildExercise`) and `file:src/lib/generateProgram.ts` (`adaptForExperience`), consistent with single-workout AI generation. JWT auth, CORS, error handling follow the established edge function patterns.

6. **Multi-day guardrail validation layer** — extends the repair-first validation pattern from `file:supabase/functions/generate-workout/validate.ts`:
   - Validates each day's exercises against the pre-filtered catalog (ID existence, equipment match)
   - Removes duplicates within a day and across the full program
   - Checks exercise count per day is within a reasonable range (4–10)
   - Verifies muscle focus coherence per day (majority of exercises match the day's stated focus)
   - Backfills from the catalog if exercises are dropped (scoped to the day's muscle group)
   - Validates overall program structure: correct number of days, every day has exercises
   - Catastrophic failure (unparseable JSON, zero valid days): single retry with amended prompt

7. **Program preview step** — shows the full AI-generated program before creation. Day-by-day summary with exercise names, muscle groups, sets, reps, rest. Reuses existing `file:src/components/library/DayCard.tsx` component pattern. Actions: "Regenerate" (re-run AI with same constraints), "Create Program" (confirm and save). On confirm, the program is created via the existing `file:src/hooks/useGenerateProgram.ts` pipeline (creates `programs` row + `workout_days` + `workout_exercises`).

8. **`useAIGenerateProgram` frontend hook** — new mutation hook that:
   - Calls the `generate-program` edge function with constraints
   - Hydrates exercise IDs from the local exercise pool or Supabase (same pattern as `file:src/hooks/useAIGenerateWorkout.ts`)
   - Returns structured program data for the preview step
   - On confirm, delegates to `file:src/hooks/useGenerateProgram.ts` for DB insertion
   - Handles loading states, errors, and timeout (same patterns as existing AI hook)

9. **Prompt engineering for program design** — system prompt that constrains the LLM to:
   - Design a training split appropriate for the user's goal, experience, and frequency
   - Provide a brief rationale for the split choice (1–2 sentences)
   - Only return exercise IDs from the provided catalog
   - Respect equipment constraints
   - Apply exercise pairing heuristics per day (compound before isolation, synergistic grouping)
   - Distribute exercises across the week so no muscle group is overtrained or neglected
   - Consider user training history (last 5 sessions) to avoid staleness
   - Handle training gaps gracefully: if history is older than 14 days or empty, propose a conservative re-entry program with moderate intensity rather than aggressive progression
   - Return structured JSON matching a defined multi-day schema (exercise IDs only — no volume; sets/reps/rest are assigned deterministically client-side)

10. **i18n** — new translation keys for the library redesign and AI program generation wizard in both FR and EN. New `create-program` namespace or extension of existing `library` namespace.

**Out of scope:**

- Changes to the Quick Workout flow (stays in side drawer, untouched)
- Changes to the onboarding wizard (continues to use template-based generation)
- Streaming or partial LLM responses (Gemini Flash is fast enough for a single structured response)
- Per-user rate limiting enforcement (same policy as `generate-workout`: off during dev, 10/day cap later)
- Multi-turn conversation with the LLM (single prompt, single response — second call only on user-initiated split modification)
- Superset, circuit, or periodization modes (flat sets only, same as current templates)
- Template editing or custom template creation
- Exercise library expansion or difficulty data backfill (only 9 of 606 exercises have null `difficulty_level` — negligible)
- AI-generated program names or descriptions (use deterministic format based on constraints)
- Offline AI generation (requires network by design)
- Admin UI for prompt management

---

## Success Criteria

- **Numeric:** AI program generation latency < 10s (p95) from constraint submission to preview render
- **Numeric:** 100% of AI-returned exercise IDs pass guardrail validation per day (zero hallucinated IDs reach the user)
- **Numeric:** AI programs contain the correct number of days, 4–10 exercises per day, and zero equipment mismatches
- **Qualitative:** AI-generated programs feel like they were designed by a knowledgeable trainer — sensible split structure for the user's goals and frequency, complementary exercise pairing within days, balanced volume distribution across the week
- **Qualitative:** The progressive reveal (split with rationale → exercises per day) gives users a sense of control without requiring program design expertise or waiting through multiple loading steps
- **Qualitative:** The unified Library page is cleaner and more intuitive than the 3-tab layout — program management, creation, and template browsing all flow naturally from a single view
- **Qualitative:** Constraint wizard is fast for returning users — under 30 seconds from "Nouveau programme" to AI preview, thanks to profile prefill
- **Qualitative:** AI programs are fully editable in the existing builder after creation — no locked or special-cased fields

---

## Dependencies

- **AI Workout Generator (shipped):** The `generate-program` edge function reuses architectural patterns from `file:supabase/functions/generate-workout/index.ts` — CORS, JWT auth, Gemini API integration, pre-filtered catalog, repair-first validation. The frontend hook follows the same mutation pattern as `file:src/hooks/useAIGenerateWorkout.ts`.
- **Onboarding & Program Generation (shipped):** The program creation pipeline (`file:src/hooks/useGenerateProgram.ts`), the `programs` / `workout_days` / `workout_exercises` tables, and the `user_profiles` table are all prerequisites.
- **Workout Library Dashboard (shipped):** The Library page (`file:src/pages/LibraryPage.tsx`), template components (`file:src/components/library/TemplateCard.tsx`, `file:src/components/library/DayCard.tsx`), program management hooks (`file:src/hooks/useUserPrograms.ts`, `file:src/hooks/useActivateProgram.ts`, `file:src/hooks/useArchiveProgram.ts`), and the `archived_at` column on `programs` are all shipped and reused.
- **User Profiles (shipped):** `user_profiles` table provides the prefill data for the constraint wizard and context for the AI prompt.
- **Supabase Auth (shipped):** JWT tokens forwarded to the edge function for user identification.

---

## Resolved Decisions

- **New edge function, not an extension:** `generate-program` is a separate edge function from `generate-workout`. The prompt, output schema (multi-day structure vs flat exercise list), and validation logic are fundamentally different. Sharing code (catalog fetching, Gemini client, CORS) happens via shared modules in `file:supabase/functions/_shared/`, not by overloading a single function.
- **Single call, progressive reveal:** The LLM returns the full program (split + exercises) in one response. The UI progressively reveals the split with rationale first, then unfolds exercises per day. This eliminates the latency of a blocking two-step interaction while preserving the UX benefit of a "thoughtful" AI that explains its reasoning. A second call only fires if the user modifies the proposed split — a rare path.
- **Full-page wizard, not a bottom sheet:** The creation wizard is a dedicated full-page experience (like onboarding), not a dialog or bottom sheet. A multi-step AI flow with constraint collection, split review, and program preview is too heavy for a sheet.
- **Library collapses to a single view:** The 3-tab layout is replaced by a unified program list. Templates move into the creation wizard. Quick Workout is dropped (already in side drawer). This simplifies the Library's mental model: it's where you manage your programs, period.
- **Templates remain as a separate path:** Templates are not deprecated or replaced by AI. They serve a different use case: quick, predictable, no-wait program adoption. AI is the smart custom path; templates are the fast familiar path.
- **LLM picks composition, code assigns volume (same as single-workout):** The LLM selects exercises (composition) — this is where AI shines. Deterministic code assigns sets, reps, and rest via the existing `buildExercise()` (compound vs isolation distinction) and `adaptForExperience()` (beginner/intermediate/advanced scaling) pipeline. Letting the LLM decide volume would introduce a whole class of hallucination risk (absurd set counts, inconsistent session lengths) that guardrails would struggle to catch. The deterministic approach is predictable, testable, and already proven.
- **Training gap awareness in the prompt:** If user training history is older than 14 days or empty, the prompt instructs the LLM to propose a conservative re-entry program with moderate intensity — prioritizing compound movements and standard volume rather than aggressive progression. The user's profile experience level is respected (an intermediate user who took 3 weeks off is still intermediate, just deconditioned), but the exercise selection errs toward accessibility.
- **Constraint wizard prefilled from profile:** All fields that exist in `user_profiles` (goal, experience, equipment, days/week, duration) are prefilled. The user can override any value for this specific program without changing their profile. Optional free-form fields (focus areas, exercise preferences) start empty.
- **Deterministic fallback messaging, not automatic fallback:** If AI generation fails, the user is informed and offered alternatives (try again, pick a template, or build from scratch). Unlike single-workout generation, there is no automatic deterministic fallback — the template and manual paths are explicitly separate creation modes, not hidden fallbacks.

---

## Relationship to Existing Epics

- **Epic Brief — AI-Powered Workout Generator:** That epic covers single-session AI generation within the Quick Workout flow. This epic extends AI generation to multi-day programs. Both share the Gemini integration, guardrail pattern, and pre-filtered catalog approach — but the prompt design, output schema, and validation are distinct.
- **Epic Brief — Onboarding & Program Generation:** That epic introduced the programs abstraction, templates, user profiles, and the onboarding wizard. This epic builds on all of that infrastructure. The onboarding flow itself is unchanged.
- **Epic Brief — Workout Library Dashboard:** That epic shipped the 3-tab Library, template browsing, and program management. This epic redesigns the Library's structure (collapsing tabs) and adds the AI creation path. Components like `TemplateCard`, `DayCard`, and management hooks are reused.
