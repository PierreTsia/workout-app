import { useEffect } from "react"
import type { SetStateAction } from "jotai"
import type { SessionState } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"

/**
 * Drops `setsData` entries whose workout-exercise row id is no longer in the merged
 * template list (e.g. after a swap/delete in the builder).
 *
 * Must not run while the day's exercises are still loading: an empty list would clear
 * all keys and wipe persisted session state on reload (issue #182).
 */
export function usePruneSessionSetsToExerciseList(
  exercises: WorkoutExercise[],
  exercisesLoading: boolean,
  setSession: (value: SetStateAction<SessionState>) => void,
): void {
  useEffect(() => {
    if (exercisesLoading) return
    const keep = new Set(exercises.map((e) => e.id))
    setSession((prev) => {
      const next = { ...prev.setsData }
      let changed = false
      for (const key of Object.keys(next)) {
        if (!keep.has(key)) {
          delete next[key]
          changed = true
        }
      }
      return changed ? { ...prev, setsData: next } : prev
    })
  }, [exercises, exercisesLoading, setSession])
}
