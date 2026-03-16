# T30 — Edge Function Scaffolding & Gemini Integration

## Goal

Set up the first Supabase Edge Function in the project — `generate-workout` — with production-grade scaffolding (CORS, JWT auth, service-role client) and a working Gemini 1.5 Flash API call with structured JSON output. This ticket delivers the infrastructure and the raw AI call, but not the prompt engineering or validation logic (those are T31).

## Dependencies

None — this is the first ticket in the epic.

## Scope

### Edge Function Directory Structure

Create the `supabase/functions/` directory with shared utilities and the `generate-workout` function:

| File | Purpose |
|---|---|
| `supabase/functions/_shared/cors.ts` | Reusable CORS headers (preflight + response). Supports `OPTIONS` method. |
| `supabase/functions/_shared/supabase.ts` | Factory for service-role Supabase client. Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env.get()`. |
| `supabase/functions/generate-workout/index.ts` | Entry point: CORS, auth, placeholder orchestration, JSON response. |

### CORS Handling

Shared `corsHeaders` object and `OPTIONS` handler pattern:

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
```

The `index.ts` handler checks `req.method === "OPTIONS"` and returns early with CORS headers.

### JWT Authentication (Two-Layer)

1. **Gateway layer:** `verify_jwt = true` in `file:supabase/config.toml` (already the default) rejects unauthenticated requests before function code runs.
2. **Function layer:** Extract Bearer token from `Authorization` header, call `supabase.auth.getUser(token)` to get verified user ID. Return 401 if verification fails. All subsequent DB queries use this verified user ID.

### Service-Role Supabase Client

Factory in `_shared/supabase.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
}
```

### Gemini API Call (`gemini.ts`)

Raw `fetch()` to `generativelanguage.googleapis.com` with:

| Config | Value | Rationale |
|---|---|---|
| Model | `gemini-1.5-flash` | Fast, cheap, sufficient for exercise selection |
| `response_mime_type` | `"application/json"` | Guarantees valid JSON output |
| `response_schema` | `{ type: "array", items: { type: "string" } }` | Output is array of exercise UUIDs |
| Temperature | `0.8` | Creative variety without chaos |
| `maxOutputTokens` | `1024` | Generous for ~13 UUIDs |
| Timeout | `8s` via `AbortController` | Prevents unbounded wait |

API key read from `Deno.env.get("GEMINI_API_KEY")`.

### Secrets Setup

Document the required Supabase Secrets:

```bash
supabase secrets set GEMINI_API_KEY=<key>
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase
```

### Placeholder Orchestration

`index.ts` wires together auth → a hardcoded prompt (for testing) → Gemini call → raw response. No DB queries, no validation, no prompt engineering yet — those are T31. The goal is to verify the full round-trip: client → edge function → Gemini → client.

## Out of Scope

- Prompt engineering and catalog serialization (T31)
- `validateAndRepair()` logic (T31)
- Frontend hook and UI changes (T32)
- DB queries for exercises, user profile, history (T31)
- Rate limiting (deferred, not in v1)

## Acceptance Criteria

- [ ] `supabase/functions/generate-workout/index.ts` exists and handles CORS preflight
- [ ] Edge function verifies JWT via `supabase.auth.getUser(token)` and returns 401 on failure
- [ ] `gemini.ts` calls Gemini 1.5 Flash with structured output config and returns parsed JSON
- [ ] 8s timeout via `AbortController` is implemented
- [ ] Calling the edge function with a valid JWT and a hardcoded prompt returns a JSON array of strings from Gemini
- [ ] `_shared/cors.ts` and `_shared/supabase.ts` are reusable by future edge functions
- [ ] `GEMINI_API_KEY` is read from Supabase Secrets, never hardcoded

## References

- [Epic Brief — AI Workout Generator](docs/Epic_Brief_—_AI_Workout_Generator.md)
- [Tech Plan — AI Workout Generator](docs/Tech_Plan_—_AI_Workout_Generator.md) — "Component Architecture > New Files" and "Critical Constraints > Service-role key management"
