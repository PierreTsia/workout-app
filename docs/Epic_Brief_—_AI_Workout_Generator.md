# Epic Brief — AI-Powered Workout Generator

## Summary

This epic adds an AI-powered workout generation mode alongside the existing deterministic Quick Workout generator. Users choose between "Quick Generate" (instant, randomized) and "AI Generate" (context-aware, LLM-powered). The AI mode sends user constraints, training history, and profile data to a Gemini 1.5 Flash model via a Supabase Edge Function, which returns a curated exercise selection. A deterministic guardrail layer validates every AI response before it reaches the user, and the existing deterministic generator serves as an automatic fallback if the AI path fails.

---

## Context & Problem

**Who is affected:** Any user who wants a smarter, more personalized workout beyond random exercise selection — especially when the deterministic generator produces repetitive or poorly-paired results.

**Current state:**
- The Quick Workout generator (shipped) selects exercises randomly from a filtered pool based on equipment, duration, and muscle focus
- Selection is purely random within constraints — no awareness of exercise pairing quality, user history, difficulty progression, or training context
- The algorithm occasionally produces awkward combinations (e.g., two heavy compound back movements in a row, or exercises the user did yesterday)
- No server-side compute exists — everything is client-side. No Supabase Edge Functions have been deployed yet.

**Pain points:**

| Pain | Impact |
|---|---|
| Random selection ignores exercise synergy | Workouts feel "thrown together" rather than programmed |
| No history awareness | Generator can repeat the exact same exercises from yesterday's session |
| No difficulty awareness | A beginner gets the same exercise pool as an advanced lifter |
| No progression intelligence | Generated workouts don't get harder over time |

---

## Goals

| Goal | Measure |
|---|---|
| Context-aware exercise selection | AI considers user profile (difficulty, equipment), training history (last 5 sessions), and exercise relationships (compound/isolation pairing, synergistic grouping) |
| Explicit progression | AI prompt includes a directive to suggest slightly more challenging exercises than the user's recent sessions |
| Sub-5-second generation latency | AI generation completes in < 5s including network round-trip (Gemini Flash p95) |
| Zero hallucination tolerance | 100% of returned exercise IDs exist in the catalog and match equipment/muscle constraints — enforced by server-side validation |
| Seamless fallback | If AI generation fails (network, validation, timeout), the user is offered the deterministic generator with no dead-end states |
| No API key exposure | Gemini API key stays in Supabase Secrets, never reaches the client |
| Reuse existing workout flow | AI-generated workouts use the same PreviewStep, session creation, and "Save as Program" flow as deterministic ones |

---

## Scope

**In scope:**

1. **Supabase Edge Function infrastructure** — first edge function in the project. Scaffolding includes CORS handling, JWT auth validation, error response patterns, and Gemini API key stored in Supabase Secrets. Local dev support via `supabase functions serve`.

2. **`generate-workout` edge function** — receives user constraints (duration, equipment category, muscle groups) plus user context (profile, recent session history). Fetches a condensed exercise catalog from the DB, constructs a prompt for Gemini 1.5 Flash, and returns a validated list of exercise IDs.

3. **Exercise catalog schema for LLM context** — a token-optimized JSON representation of the exercise library (~600 exercises). Includes: ID, name (EN), muscle group, equipment, secondary muscles, difficulty level. Designed to fit comfortably in a single prompt while giving the LLM enough information to make intelligent selections.

4. **Guardrail validation layer** — server-side `validateWorkout()` function that checks every LLM response:
   - All exercise IDs exist in the catalog
   - Equipment matches the user's constraint
   - Exercise count matches the duration's volume target (from `VOLUME_MAP`)
   - No duplicate exercises
   - On validation failure: retry with error feedback (max 2 retries), then return error to client

5. **User context in the prompt** — the AI receives:
   - User profile: difficulty level, equipment preference (from `user_profiles`)
   - Training history: exercise IDs from the user's last 5 sessions (from `set_logs` + `sessions`), to avoid repetition and inform progression
   - Progression directive: the system prompt instructs the LLM to suggest slightly more challenging exercises than the user's recent sessions (e.g., progressing from machine to free-weight variants, or from beginner to intermediate difficulty)
   - The full constraint set: duration, equipment category, muscle focus

6. **Frontend AI mode** — two generation buttons in the Quick Workout constraint step:
   - "Quick Generate" — existing deterministic generator (instant)
   - "AI Generate" — calls the edge function, shows a loading state (shimmer/skeleton), then transitions to the same PreviewStep
   - On AI error: toast notification + automatic offer to fall back to Quick Generate
   - The deterministic sets/reps/rest assignment (`buildExercise()`, `VOLUME_MAP`) is applied client-side after AI returns exercise IDs — the LLM only picks composition
   - AI button disabled/hidden when offline (requires network)

7. **Prompt engineering** — system prompt that constrains the LLM to:
   - Only return exercise IDs from the provided catalog
   - Respect equipment and muscle group filters
   - Apply exercise pairing heuristics (compound before isolation, synergistic grouping, avoid back-to-back same-movement-pattern)
   - Consider user history to avoid repetition
   - Apply progressive overload: suggest slightly more challenging exercises than recent sessions
   - Return structured JSON matching a defined schema

8. **i18n** — new translation keys for AI mode UI strings in both FR and EN (generator namespace)

**Out of scope:**
- AI-generated sets/reps/rest (deterministic math handles this — simpler, more predictable, no hallucination risk)
- AI-generated workout names or descriptions
- Streaming/partial responses (Gemini Flash is fast enough for a single response)
- Per-user rate limiting enforcement (disabled during testing; the architecture supports a 10/day cap per user to be enabled once the feature is stable)
- Prompt caching or exercise catalog materialized views (premature optimization)
- Multi-turn conversation with the LLM (single prompt, single response)
- Superset/circuit/EMOM generation modes
- Admin UI for prompt management
- Offline AI generation (requires network by design)

---

## Success Criteria

- **Numeric:** AI generation latency < 5s (p95) from button tap to PreviewStep render
- **Numeric:** 100% of AI-returned exercise IDs pass guardrail validation (no hallucinated IDs reach the user)
- **Numeric:** AI-generated workouts contain zero equipment mismatches and correct exercise count for the selected duration
- **Qualitative:** AI workouts feel noticeably more coherent than random selection — sensible exercise ordering, no awkward pairings, variety across sessions
- **Qualitative:** The two-button UX is clear and non-confusing — users understand the difference between Quick and AI modes
- **Qualitative:** Fallback to deterministic generation is seamless — no dead-end error states
- **Qualitative:** Over repeated uses, AI suggestions show visible progression (harder variants, different exercises) rather than cycling the same pool

---

## Dependencies

- **Quick Workout Generator (shipped):** The AI mode augments the existing flow. `file:src/components/generator/QuickWorkoutSheet.tsx`, `file:src/lib/generateWorkout.ts`, and the PreviewStep are reused as-is.
- **User Profiles (shipped):** `user_profiles` table with `equipment` and difficulty-related fields provides context for the AI prompt.
- **Session History (shipped):** `sessions` + `set_logs` tables provide training history context.
- **Supabase Auth (shipped):** JWT tokens forwarded to the edge function for user identification.

---

## Resolved Decisions

- **Two modes, not a replacement:** AI generation lives alongside the deterministic generator. "Quick Generate" stays for instant, offline-capable generation. "AI Generate" is the premium path when online.
- **LLM picks composition only:** Sets, reps, and rest are calculated deterministically client-side using existing `VOLUME_MAP` and compound/isolation logic. This eliminates an entire class of hallucination risk.
- **Deterministic generator as fallback:** Not a static template. If AI fails, we fall back to the fully functional random generator — same as today.
- **Rate limiting: off for now, 10/day later.** During development/testing (single user), no enforcement. The edge function will be architected to support a 10-generation-per-user-per-day cap that can be enabled via a flag or config once the feature ships to real users.
- **Full context for the AI:** User profile + training history (last 5 sessions) + exercise catalog. This is what makes the AI mode worth having — otherwise it's just expensive random selection.
- **Explicit progression directive:** The system prompt instructs the LLM to nudge users toward harder exercises over time, based on their recent history.
- **AI requires network:** The AI button is disabled/hidden when offline. Quick Generate remains the offline-capable option.
