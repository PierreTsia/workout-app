# T31 — Prompt Engineering & Validation Layer

## Goal

Build the prompt construction pipeline (exercise catalog serialization, user context injection, system prompt) and the muscle-group-aware `validateAndRepair()` function. After this ticket, the edge function produces validated, coherent exercise selections from real DB data — ready for the frontend to consume.

## Dependencies

- **T30 — Edge Function Scaffolding & Gemini Integration:** the edge function entry point, CORS, auth, service-role client, and `gemini.ts` must be in place.

## Scope

### DB Queries (3 parallel queries in `index.ts`)

Wire the 3 `Promise.all` queries into the edge function using the verified user ID from T30's auth layer:

**Q1 — Pre-filtered exercise catalog:**

```sql
SELECT id, name_en, muscle_group, equipment, secondary_muscles, difficulty_level
FROM exercises
WHERE equipment IN (:equipmentValues)
  AND (:isFullBody OR muscle_group IN (:muscleGroups))
ORDER BY muscle_group, name
```

Post-query: if result count > 120, cap at 15 per muscle group via in-memory sampling.

**Q2 — User profile:**

```sql
SELECT experience, goal, equipment, training_days_per_week
FROM user_profiles
WHERE user_id = :userId
```

Returns null if the user hasn't completed onboarding — handle gracefully (omit profile section from prompt).

**Q3 — Recent training history (last 5 sessions):**

Fetch 5 most recent completed session IDs, then collect their distinct exercise IDs and name snapshots.

### Request Body Parsing

The edge function expects a JSON body with the user's constraints:

```typescript
interface GenerateWorkoutRequest {
  duration: 15 | 30 | 45 | 60 | 90
  equipmentCategory: "bodyweight" | "dumbbells" | "full-gym"
  muscleGroups: string[]
}
```

Map `equipmentCategory` to DB equipment values using the same `EQUIPMENT_CATEGORY_MAP` logic from `file:src/lib/generatorConfig.ts`. The config values are duplicated in the edge function (no shared imports between Deno and Vite).

### Prompt Construction (`prompt.ts`)

Build the system prompt from the Tech Plan template:

- **System prompt rules:** exercise ID constraints, ordering heuristics (compound first), history avoidance, progressive overload directive, synergistic grouping, full-body distribution
- **User profile section:** experience, goal, equipment preference. Omitted if profile is null.
- **Recent exercises section:** exercise IDs and names from last 5 sessions. Omitted if no history.
- **Constraints section:** duration, equipment, focus, target exercise count (from `VOLUME_MAP`)
- **Exercise catalog section:** compact JSON array with short keys (`id`, `n`, `mg`, `eq`, `sm`, `dl`)

`VOLUME_MAP` is duplicated as a constant in the edge function:

```typescript
const VOLUME_MAP: Record<number, { exerciseCount: number }> = {
  15: { exerciseCount: 4 },
  30: { exerciseCount: 5 },
  45: { exerciseCount: 7 },
  60: { exerciseCount: 9 },
  90: { exerciseCount: 13 },
}
```

### Validation (`validate.ts`)

`validateAndRepair()` receives the full pre-filtered catalog and the LLM output:

```typescript
interface CatalogExercise {
  id: string
  muscle_group: string
  equipment: string
}

interface ValidationResult {
  exerciseIds: string[]
  repaired: boolean
  dropped: number
  backfilled: number
}

function validateAndRepair(
  llmOutput: string[],
  catalog: CatalogExercise[],
  targetCount: number,
): ValidationResult
```

Steps:
1. Build catalog lookup map `Map<string, CatalogExercise>`
2. Filter: keep only IDs present in the catalog. For each dropped ID, record its `muscle_group`
3. Deduplicate
4. **Muscle-group-aware backfill:** for each missing slot, pick an unused exercise from the same `muscle_group` as the dropped exercise. If that group's pool is exhausted, fall back to any unused exercise.
5. If count > target: trim to target
6. If zero valid exercises: return error (triggers 1 retry with error feedback appended to the prompt)

### Full Orchestration

Wire everything together in `index.ts`:

1. Auth (from T30)
2. Parse request body
3. `Promise.all` — 3 DB queries
4. Build prompt (`prompt.ts`)
5. Call Gemini (`gemini.ts` from T30)
6. Validate and repair (`validate.ts`)
7. Return `{ exerciseIds: string[], repaired: boolean }` or `{ error: string }`

## Out of Scope

- Frontend hook and UI changes (T32)
- i18n keys (T32)
- Rate limiting (deferred)
- Prompt caching or exercise catalog materialized views

## Acceptance Criteria

- [ ] Edge function accepts `{ duration, equipmentCategory, muscleGroups }` and returns `{ exerciseIds: string[] }`
- [ ] Exercise catalog is pre-filtered by equipment + muscle group before prompt construction
- [ ] Catalog is capped at 15 per muscle group when pool exceeds 120
- [ ] Prompt includes user profile context when available, omits it gracefully when null
- [ ] Prompt includes recent exercise history (last 5 sessions) when available
- [ ] `validateAndRepair()` drops invalid/duplicate IDs and backfills from the same muscle group
- [ ] Backfill falls back to any unused exercise only when the target muscle group's pool is exhausted
- [ ] On zero valid exercises: retry once with error feedback, then return error
- [ ] End-to-end test: calling the edge function with real constraints returns valid exercise IDs that exist in the DB

## References

- [Epic Brief — AI Workout Generator](docs/Epic_Brief_—_AI_Workout_Generator.md)
- [Tech Plan — AI Workout Generator](docs/Tech_Plan_—_AI_Workout_Generator.md) — "Component Architecture > Component Responsibilities" (prompt.ts, validate.ts sections)
