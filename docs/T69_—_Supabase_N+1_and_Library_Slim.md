# T69 — Supabase N+1 Elimination & Library Slim

## Goal

Eliminate the `exercises?id=eq…` request storm triggered when a workout day loads (currently 5-15 parallel per-id calls via `useExerciseFromLibrary`) by embedding the full exercise row inside the `workout_exercises` query. Slim the catalog-level `useExerciseLibrary` fetch from `select('*')` (~161 KB) to enumerated columns (~60 KB) by deferring rich fields (`instructions` JSONB, `youtube_url`, etc.) to `useExerciseById`. Replace the per-id loop in `useGenerateProgram` with a single batched `.in()` call. This ticket is the last major Supabase/network optimization of Epic #104.

## Dependencies

None strictly. Can ship in parallel with T67/T68.

## Scope

### `useWorkoutExercises` embed — `file:src/hooks/useWorkoutExercises.ts`

Current:

```typescript
const { data, error } = await supabase
  .from("workout_exercises")
  .select("*")
  .eq("workout_day_id", dayId!)
```

Target:

```typescript
const { data, error } = await supabase
  .from("workout_exercises")
  .select(`
    *,
    exercise:exercises(
      id, name, name_en, emoji, muscle_group, equipment,
      image_url, instructions, secondary_muscles, difficulty_level
    )
  `)
  .eq("workout_day_id", dayId!)
```

After fetching, seed the per-id cache so downstream `useExerciseById` calls hit memory:

```typescript
if (data) {
  const uniqueExercises = new Map<string, Exercise>()
  data.forEach((row) => {
    if (row.exercise) uniqueExercises.set(row.exercise.id, row.exercise)
  })
  uniqueExercises.forEach((exercise, id) => {
    queryClient.setQueryData(["exercise", id], exercise)
  })
}
```

Use the functional pattern from workspace rule — no mutable for-loops:

```typescript
const uniqueExercises = (data ?? [])
  .map((row) => row.exercise)
  .filter((ex): ex is Exercise => !!ex)
  .reduce((map, ex) => map.set(ex.id, ex), new Map<string, Exercise>())

uniqueExercises.forEach((ex, id) => queryClient.setQueryData(["exercise", id], ex))
```

Update the TypeScript return type to reflect the embed (e.g. `WorkoutExerciseWithExercise`).

### `useExerciseLibrary` slim — `file:src/hooks/useExerciseLibrary.ts`

Current:

```typescript
.from("exercises")
.select("*")
.order("muscle_group")
.order("name")
```

Target:

```typescript
.from("exercises")
.select("id, name, name_en, emoji, muscle_group, equipment, image_url, difficulty_level, is_system")
.order("muscle_group")
.order("name")
```

Change the return type:

```typescript
// file:src/types/exercise.ts (or wherever Exercise lives)
export type ExerciseListItem = Pick<
  Exercise,
  "id" | "name" | "name_en" | "emoji" | "muscle_group" | "equipment" | "image_url" | "difficulty_level" | "is_system"
>
```

`useExerciseLibrary` now returns `ExerciseListItem[]`. TypeScript will flag every caller that expects rich fields (`instructions`, `youtube_url`, `secondary_muscles`, `source`, `reviewed_*`) — those must switch to `useExerciseById(id)`.

### `useExerciseFromLibrary` audit — `file:src/hooks/useExerciseFromLibrary.ts`

Identify callers that now have the embedded exercise from `useWorkoutExercises`:

- `file:src/components/workout/SetsTable.tsx`
- `file:src/components/workout/ExerciseDetail.tsx`
- `file:src/components/workout/SessionSummary.tsx`

These should prefer the embedded `row.exercise` (passed as prop) rather than re-fetching via `useExerciseFromLibrary(exercise_id)`. **Minimum viable change:** rely on the per-id cache seeded by `useWorkoutExercises` (T69) — the hook still works but hits memory instead of network. Ideal future change: pass `exercise` via prop and drop the hook. Stay minimal here unless the change is trivial.

**Keep `useExerciseFromLibrary` intact** for pages where per-id is legitimately needed:
- `file:src/components/builder/ExerciseRow.tsx`
- `file:src/components/builder/ExerciseDetailEditor.tsx`
- `file:src/components/exercise/ExerciseInstructionsPanel.tsx`
- `file:src/pages/library/ExerciseLibraryExercisePage.tsx`

### `AIGeneratingStep` dedicated query — `file:src/components/create-program/AIGeneratingStep.tsx`

If the generation prompt needs rich fields (confirm during implementation), DO NOT re-widen `useExerciseLibrary`. Instead add a dedicated query scoped to that step:

```typescript
function useExercisePoolForGeneration() {
  return useQuery({
    queryKey: ["exercise-pool-for-gen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("id, name, muscle_group, equipment, instructions, secondary_muscles, difficulty_level")
        .order("muscle_group")
      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}
```

If the step currently uses `useExerciseLibrary`, migrate to the new hook. If it only needs the narrow shape, no change needed.

### `useGenerateProgram` batching — `file:src/hooks/useGenerateProgram.ts` (around line 89)

Current (per-id fetches in a loop):

```typescript
const { data } = await supabase
  .from("exercises")
  .select("*")
  .eq("id", resolvedId)
  .single()
```

Target (single batch via existing helper):

```typescript
import { fetchExercisesByIds } from "@/lib/fetchExercisesByIds"

// collect all resolvedIds upfront
const resolvedIds = [...]  // build from the swap plan
const batch = await fetchExercisesByIds(resolvedIds)
const byId = new Map(batch.map((ex) => [ex.id, ex]))

// then use byId.get(resolvedId) inside the mapping
```

Use the existing `fetchExercisesByIds` helper (chunked `.in('id', chunk)` with chunk size 100) from `file:src/lib/fetchExercisesByIds.ts`.

## Out of Scope

- Converting `workout_exercises` snapshot fields (`name_snapshot`, `emoji_snapshot`) into foreign-key-enforced data → existing architecture decision, unchanged
- `useExerciseFromLibrary` deletion / hook consolidation → follow-up after confirming all callers are migrated
- RPC-based pagination for `useExerciseLibrary` → rejected in plan (user said no regression, RPC changes the contract)
- Deferring `useExerciseLibrary` until swap UI opens → rejected in plan (eager fetch + slim is cleaner)
- Supabase 406 / duplicate fetches → **T66**
- Route splitting / vendor chunks → **T67 / T68**

## Acceptance Criteria

- [ ] `useWorkoutExercises` returns `workout_exercises` rows each with an embedded `exercise` object.
- [ ] Network panel on `/` load shows **at most one** `workout_exercises?…workout_day_id=eq…` request per visible day, AND **zero** follow-up `exercises?id=eq…` requests for those exercises.
- [ ] `useExerciseLibrary` fires a single request with `select=id,name,name_en,emoji,muscle_group,equipment,image_url,difficulty_level,is_system` (verified via network panel).
- [ ] Catalog fetch payload on `/` is reduced from ~161 KB to ~60 KB or less.
- [ ] `useGenerateProgram` swap path uses a single batched `.in('id', ...)` call (verified via network panel during AI program generation).
- [ ] No TypeScript errors after tightening `useExerciseLibrary`'s return type to `ExerciseListItem[]`.
- [ ] All callers that needed rich fields (instructions, etc.) have been migrated to `useExerciseById` or a dedicated query — verified by running the app and visiting: session view → exercise detail, builder → exercise edit, library → exercise detail.
- [ ] `ExerciseInstructionsPanel` still renders full instructions correctly.
- [ ] AI program generation flow still produces the same prompt quality (manual spot check with a known input).
- [ ] No Playwright E2E regressions.
- [ ] `npx tsc --noEmit` passes.

## References

- Epic / issue: [#104](https://github.com/PierreTsia/workout-app/issues/104)
- Tech Plan: `file:docs/Tech_Plan_—_Lighthouse_CLS_LCP_Supabase_#104.md`
- Existing batch helper: `file:src/lib/fetchExercisesByIds.ts`
- PostgREST embed docs: https://postgrest.org/en/stable/references/api/resource_embedding.html
