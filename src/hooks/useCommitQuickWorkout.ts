// PWA hook for the Quick Workout AI commit phase (T128, #342). The
// counterpart to `useGenerateQuickWorkoutPreview` — same shape (mutation
// against an Edge function), same typed-error contract for the UI.
//
// Lock-ins:
//   1. Translates the rich `GeneratedWorkout` into the MCP object form
//      via `workoutToMcpExercises` so the persisted day matches what the
//      user previewed (no silent reset to "3x10 / 90s rest" defaults).
//   2. Maps 502 `{ error: "commit_failed", kind }` to a typed error so
//      the UI can branch on transport vs tool failure without parsing
//      `Error.message`.
//   3. Invalidates `workout-days` queries on success so day list shows
//      the new day immediately — same pattern `useCreateQuickWorkout`
//      uses for the deterministic path.

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { workoutToMcpExercises } from "@/lib/quickWorkout"
import type { GeneratedWorkout } from "@/types/generator"

interface CommitQuickWorkoutInput {
  workout: GeneratedWorkout
}

interface CommitFailedError extends Error {
  kind: "commit_failed"
  reason: string
}

function makeCommitFailedError(reason: string): CommitFailedError {
  const err = new Error(`commit_failed: ${reason}`) as CommitFailedError
  err.kind = "commit_failed"
  err.reason = reason
  return err
}

export function isCommitFailedError(err: unknown): err is CommitFailedError {
  return (
    err instanceof Error &&
    (err as Partial<CommitFailedError>).kind === "commit_failed"
  )
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes("fetch")) return true
  if (!(err instanceof Error)) return false
  if (err.name === "FunctionsFetchError") return true
  if (err.name === "FunctionsRelayError") return true
  if (err.message.includes("name resolution")) return true
  return false
}

function invokeErrorContext(err: unknown): Response | undefined {
  if (typeof err !== "object" || err === null) return undefined
  if (!("context" in err)) return undefined
  const ctx = err.context
  return ctx instanceof Response ? ctx : undefined
}

async function readErrorPayload(ctx: Response): Promise<{ error?: string; kind?: string }> {
  // The Response has been consumed at most once by supabase-js; clone first
  // so we can read the JSON body without disturbing other handlers. Best
  // effort: empty body / non-JSON falls back to {}.
  try {
    const cloned = ctx.clone()
    return (await cloned.json()) as { error?: string; kind?: string }
  } catch {
    return {}
  }
}

export function useCommitQuickWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      workout,
    }: CommitQuickWorkoutInput): Promise<{ workoutDayId: string }> => {
      const body = {
        label: workout.name,
        exercises: workoutToMcpExercises(workout.exercises),
      }

      const { data, error } = await supabase.functions.invoke(
        "commit-quick-workout",
        { body },
      )

      if (error) {
        const ctx = invokeErrorContext(error)
        if (ctx?.status === 502) {
          const payload = await readErrorPayload(ctx)
          throw makeCommitFailedError(payload.kind ?? "unknown")
        }
        throw error
      }

      const id = (data as { workout_day_id?: string } | null)?.workout_day_id
      if (typeof id !== "string" || id === "") {
        throw new Error("commit-quick-workout returned no workout_day_id")
      }

      return { workoutDayId: id }
    },
    onSuccess: () => {
      // Same key family `useCreateQuickWorkout` invalidates so the day
      // list / saved-workout list refreshes regardless of which path
      // wrote the row.
      queryClient.invalidateQueries({ queryKey: ["workout-days"] })
    },
  })
}
