# T33 — Testing & Hardening

## Goal

Add test coverage for the AI generation pipeline — both the edge function logic and the frontend integration. Establish a prompt regression baseline and verify all failure/fallback scenarios work as designed.

## Dependencies

- **T32 — Frontend AI Generation Mode:** the full pipeline (edge function + frontend) must be wired and functional.

## Scope

### Edge Function Unit Tests

Test `validateAndRepair()` in isolation:

| Test case | Input | Expected |
|---|---|---|
| All IDs valid | 5 valid IDs, target 5 | `{ exerciseIds: [5], repaired: false }` |
| Some IDs invalid | 3 valid + 2 hallucinated, target 5 | Drops 2, backfills 2 from same muscle groups |
| Duplicate IDs | 5 IDs with 1 duplicate, target 5 | Deduplicates, backfills 1 |
| All IDs invalid | 5 hallucinated IDs | Returns error (zero valid) |
| Backfill exhausts group | 1 valid Pectoraux + 4 invalid Pectoraux, only 2 Pectoraux in pool | Backfills 2 Pectoraux + 2 from other groups |
| Over target count | 7 valid IDs, target 5 | Trims to 5 |

Test `buildPrompt()` from `prompt.ts`:

| Test case | Expected |
|---|---|
| Full context (profile + history + catalog) | Prompt contains all 4 sections |
| No user profile | Prompt omits USER PROFILE section |
| No session history | Prompt omits RECENT EXERCISES section |
| Catalog > 120 exercises | Capped at 15 per muscle group |

### Frontend Hook Tests

Test `useAIGenerateWorkout` with mocked `supabase.functions.invoke`:

| Test case | Expected |
|---|---|
| Success with all IDs in cache | Returns `GeneratedWorkout` with correct exercises, sets/reps/rest from `buildExercise()` |
| Success with cache miss | Falls back to direct Supabase query for missing IDs |
| Edge function returns error | Mutation `onError` fires with error message |
| Network failure | `onError` detects `TypeError: Failed to fetch` specifically |
| Edge function timeout | `onError` fires (Supabase client handles the timeout error) |

### Fallback Scenario Tests

Test the full fallback flow in `QuickWorkoutSheet`:

| Scenario | Expected behavior |
|---|---|
| AI succeeds | Transitions to PreviewStep with AI-generated workout |
| AI fails (generic error) | Toast + "Use Quick Generate?" prompt visible |
| AI fails (network error) | Immediate fallback prompt, no toast |
| User clicks "Quick Generate" after AI failure | Deterministic generation works normally |
| AI button while offline | Button is disabled |
| AI button while session active | Button is hidden |

### Prompt Regression Baseline

Create a snapshot test for the prompt template:

- Given a fixed set of inputs (constraints, profile, history, catalog), assert the prompt output matches a stored snapshot
- This catches unintended prompt drift during future refactoring
- Store the snapshot alongside the test file

## Out of Scope

- E2E Playwright tests for the AI flow (requires a live Gemini API — not suitable for CI)
- Load testing or performance benchmarking
- Rate limiting implementation
- Prompt optimization iterations (separate task post-launch)

## Acceptance Criteria

- [ ] `validateAndRepair()` has unit tests covering all 6 cases in the table above
- [ ] `buildPrompt()` has unit tests covering all 4 context combinations
- [ ] `useAIGenerateWorkout` has unit tests with mocked edge function responses
- [ ] Fallback scenarios are tested: generic error, network error, offline, active session
- [ ] Prompt snapshot test exists and passes
- [ ] All tests pass in CI (`npm run test`)

## References

- [Epic Brief — AI Workout Generator](docs/Epic_Brief_—_AI_Workout_Generator.md) — "Success Criteria"
- [Tech Plan — AI Workout Generator](docs/Tech_Plan_—_AI_Workout_Generator.md) — "Failure Mode Analysis"
