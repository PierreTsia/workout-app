# T43 — Frontend Hook, Types & Volume Pipeline

## Goal

Create the `useAIGenerateProgram` mutation hook, TypeScript types, and Zod schema that bridge the `generate-program` edge function to the frontend. After this ticket, calling the hook with constraints returns a fully hydrated `AIGeneratedProgram` with deterministic volume — ready for the preview UI (T46).

## Dependencies

T41 (edge function endpoint must be callable).

## Scope

### TypeScript types

`src/types/aiProgram.ts`:

```typescript
export interface GenerateProgramConstraints {
  daysPerWeek: number
  duration: number
  equipmentCategory: string
  goal: string
  experience: string
  focusAreas?: string
  splitPreference?: string
}

export interface AIGeneratedProgram {
  rationale: string
  days: AIGeneratedDay[]
}

export interface AIGeneratedDay {
  label: string
  muscleFocus: string
  exercises: GeneratedExercise[]
}
```

Reuses `GeneratedExercise` from `file:src/types/generator.ts`.

### Zod schema

`src/components/create-program/schema.ts`:

Zod schema for `GenerateProgramConstraints` — validates form input before API call:

| Field | Rule |
|---|---|
| `daysPerWeek` | `z.number().int().min(2).max(7)` |
| `duration` | `z.number().refine(v => [15, 30, 45, 60, 90].includes(v))` |
| `equipmentCategory` | `z.enum(["bodyweight", "dumbbells", "full-gym"])` |
| `goal` | `z.enum(["strength", "hypertrophy", "endurance", "general_fitness"])` |
| `experience` | `z.enum(["beginner", "intermediate", "advanced"])` |
| `focusAreas` | `z.string().optional()` |
| `splitPreference` | `z.string().optional()` |

### Mutation hook

`src/hooks/useAIGenerateProgram.ts`:

1. `useMutation` wrapping `supabase.functions.invoke("generate-program", { body: constraints })`
2. On success: receives `{ rationale, days: [{ label, muscle_focus, exercise_ids }] }`
3. Collect all unique exercise IDs across all days
4. Hydrate from exercise pool query cache; fall back to `supabase.from("exercises").select("*").in("id", missingIds)` for cache misses (same pattern as `file:src/hooks/useAIGenerateWorkout.ts`)
5. For each day, for each exercise: apply `buildExercise(exercise, VOLUME_MAP[duration].setsPerExercise)` from `file:src/lib/generateWorkout.ts`
6. Return `AIGeneratedProgram`

Network error detection: reuse `isNetworkError()` from `file:src/hooks/useAIGenerateWorkout.ts`.

## Out of Scope

- UI components (T44—T46)
- Edge function internals (T41—T42)
- Program creation/persistence (T46)

## Acceptance Criteria

- [ ] `AIGeneratedProgram`, `AIGeneratedDay`, `GenerateProgramConstraints` types are exported
- [ ] Zod schema validates all constraint fields with correct rules
- [ ] Hook calls the edge function and returns a typed `AIGeneratedProgram`
- [ ] Exercise IDs are hydrated to full `Exercise` objects (cache hit + fallback)
- [ ] Each exercise has deterministic volume via `buildExercise()` + `VOLUME_MAP[duration]`
- [ ] Network errors are detected and surfaced via `meta.isNetworkError`
- [ ] Hook exposes `isPending`, `isError`, `error`, `data`, `mutateAsync`

## References

- Epic Brief: `file:docs/Epic_Brief_—_AI-Powered_Program_Generation.md` (Scope item 8)
- Tech Plan: `file:docs/Tech_Plan_—_AI-Powered_Program_Generation.md` (useAIGenerateProgram section)
- Existing pattern: `file:src/hooks/useAIGenerateWorkout.ts`
