# T32 — Frontend AI Generation Mode

## Goal

Add the "AI Generate" button alongside the existing "Quick Generate" in the Quick Workout sheet, wire it to the edge function via `useAIGenerateWorkout`, and handle all loading, error, and fallback states. After this ticket, users can choose between instant deterministic generation and context-aware AI generation from the same UI.

## Dependencies

- **T30 — Edge Function Scaffolding & Gemini Integration:** edge function is deployed and callable
- **T31 — Prompt Engineering & Validation Layer:** edge function returns validated exercise IDs from real data

## Scope

### New Hook: `useAIGenerateWorkout`

File: `file:src/hooks/useAIGenerateWorkout.ts`

```typescript
interface AIGenerateParams {
  constraints: GeneratorConstraints
}
```

- `useMutation` wrapping `supabase.functions.invoke("generate-workout", { body })`
- On success: receives `{ exerciseIds: string[] }`, hydrates each from the `useExercisesForGenerator` query cache
- Cache miss fallback: fetches missing exercises via `supabase.from("exercises").select("*").in("id", missingIds)`
- Applies `buildExercise()` from `file:src/lib/generateWorkout.ts` to each exercise (deterministic sets/reps/rest from `VOLUME_MAP`)
- Returns a `GeneratedWorkout` compatible with the existing `PreviewStep`
- **Network error handling:** `onError` detects network failures (`TypeError: Failed to fetch`, `FunctionsFetchError`). On network error: immediately offer deterministic fallback instead of generic toast.

### Modified: `ConstraintStep.tsx`

Replace the single "Generate" button with two buttons:

- **"Quick Generate"** — `variant="outline"`, calls existing `onGenerate` prop (deterministic path)
- **"AI Generate"** — `variant="default"` (primary/filled), calls new `onAIGenerate` prop
- AI button disabled when `!navigator.onLine` or `isAILoading`
- Both buttons respect the active-session guard (same `sessionAtom.isActive` check)

New props added to `ConstraintStepProps`:

```typescript
onAIGenerate: () => void
isAILoading: boolean
```

### Modified: `QuickWorkoutSheet.tsx`

- Instantiate `useAIGenerateWorkout` mutation
- New `handleAIGenerate()` callback:
  - Calls `mutateAsync({ constraints })`
  - On success: sets `generatedWorkout`, transitions to preview step
  - On error (network): show targeted fallback prompt ("Network error — use Quick Generate?")
  - On error (other): toast via `sonner` + offer deterministic fallback
- Pass `onAIGenerate` and `isAILoading` to `ConstraintStep`

### i18n Keys

New keys in the `generator` namespace:

**English (`file:src/locales/en/generator.json`):**

| Key | Value |
|---|---|
| `aiGenerate` | `"AI Generate"` |
| `aiGenerating` | `"AI is thinking…"` |
| `aiError` | `"AI generation failed"` |
| `aiFallback` | `"Use Quick Generate instead?"` |
| `networkError` | `"Network error — try Quick Generate"` |

**French (`file:src/locales/fr/generator.json`):**

| Key | Value |
|---|---|
| `aiGenerate` | `"Générer avec l'IA"` |
| `aiGenerating` | `"L'IA réfléchit…"` |
| `aiError` | `"La génération IA a échoué"` |
| `aiFallback` | `"Utiliser la génération rapide ?"` |
| `networkError` | `"Erreur réseau — essaie la génération rapide"` |

### `buildExercise` Export

`buildExercise()` in `file:src/lib/generateWorkout.ts` is currently a module-private function. It needs to be exported so `useAIGenerateWorkout` can use it to apply deterministic sets/reps/rest to AI-selected exercises.

## Out of Scope

- Edge function code changes (T30, T31)
- Automated tests (T33)
- Rate limiting UI (deferred)
- Offline AI generation
- AI-generated workout names

## Acceptance Criteria

- [ ] `ConstraintStep` shows two buttons: "Quick Generate" (outline) and "AI Generate" (primary)
- [ ] Tapping "AI Generate" calls the edge function and transitions to PreviewStep on success
- [ ] Loading state shows "AI is thinking..." while the edge function call is in progress
- [ ] On AI error: toast + "Use Quick Generate instead?" prompt
- [ ] On network error: immediate fallback prompt, no infinite loading state
- [ ] AI button is disabled when offline (`navigator.onLine === false`)
- [ ] AI button is hidden when a session is active (`sessionAtom.isActive`)
- [ ] `buildExercise()` is exported from `generateWorkout.ts` and used by the AI hook
- [ ] AI-generated workouts use the same PreviewStep, session creation, and Save as Program flow as deterministic ones
- [ ] i18n keys added in both EN and FR

## References

- [Epic Brief — AI Workout Generator](docs/Epic_Brief_—_AI_Workout_Generator.md) — "Scope > 6. Frontend AI mode"
- [Tech Plan — AI Workout Generator](docs/Tech_Plan_—_AI_Workout_Generator.md) — "Component Architecture > Modified Files" and "useAIGenerateWorkout" sections
