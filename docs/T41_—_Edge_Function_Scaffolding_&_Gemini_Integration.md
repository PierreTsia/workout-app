# T41 — Edge Function Scaffolding & Gemini Integration

## Goal

Create the `generate-program` Supabase Edge Function with auth, CORS, parallel DB queries, and a Gemini 2.5 Flash client configured for nested structured output. This ticket delivers the working infrastructure — a callable endpoint that fetches the exercise catalog, user profile, and training history, calls Gemini, and returns raw (unvalidated) results.

## Dependencies

None. Parallelizable with T40.

## Scope

### Config

Add to `file:supabase/config.toml`:

```toml
[functions.generate-program]
verify_jwt = false
```

### Edge function entry point

`supabase/functions/generate-program/index.ts`:

- CORS preflight handling (reuse `file:supabase/functions/_shared/cors.ts`)
- JWT extraction: decode `Authorization` header to get user ID (same pattern as `file:supabase/functions/generate-workout/index.ts`)
- Parse request body: `{ daysPerWeek, duration, equipmentCategory, goal, experience, focusAreas?, splitPreference? }`
- 3 parallel DB queries via `Promise.all`:
  - **Catalog:** all exercises filtered by equipment only (no muscle group filter), capped at 120 (15/group)
  - **Profile:** `user_profiles` for the authenticated user
  - **History:** last 5 completed sessions + their exercise IDs. Compute `training_gap` flag (most recent `finished_at` > 14 days ago)
- Call Gemini via `gemini.ts` (placeholder prompt for now — real prompt in T42)
- Return raw Gemini response (validation added in T42)

### Gemini client

`supabase/functions/generate-program/gemini.ts` — `callGeminiProgram()`:

- Gemini 2.5 Flash (`gemini-2.5-flash:generateContent`)
- `response_mime_type: "application/json"`
- `response_schema`: nested object schema `{ rationale: STRING, days: ARRAY of { label: STRING, muscle_focus: STRING, exercise_ids: ARRAY of STRING } }`
- `temperature: 0.7`
- `maxOutputTokens: 4096`
- `thinkingBudget: 0`
- Timeout: `15_000ms` via `AbortController`
- Parse response, skip thinking parts (same as `file:supabase/functions/generate-workout/gemini.ts`), return typed `GenerateProgramResponse`

### Shared modules

Reuse existing `file:supabase/functions/_shared/cors.ts` and `file:supabase/functions/_shared/supabase.ts`. No changes needed.

## Out of Scope

- Prompt engineering (T42)
- Multi-day validation layer (T42)
- Frontend hook (T43)
- Retry logic (T42)

## Acceptance Criteria

- [ ] `supabase functions serve` starts without errors
- [ ] `curl` to the endpoint with a valid JWT returns a JSON response from Gemini
- [ ] Catalog query returns exercises filtered by equipment, capped at 120
- [ ] Profile query returns user profile data
- [ ] History query returns recent exercise IDs and computes `training_gap` correctly
- [ ] CORS preflight returns correct headers
- [ ] Invalid/missing JWT returns 401
- [ ] Gemini timeout (>15s) returns `{ error: "timeout" }`

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md`
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (Edge Function section)
- Existing patterns: `file:supabase/functions/generate-workout/index.ts`, `file:supabase/functions/generate-workout/gemini.ts`
