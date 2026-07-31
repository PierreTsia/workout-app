import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import { LABEL_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import { fetchExercisesByIds } from "@/lib/fetchExercisesByIds"
import type { ExerciseLabelFields } from "@/types/database"

export interface ExerciseOption {
  id: string
  /**
   * Snapshot name, kept as the display value here. T150 resolves the localized
   * label from `exercise` and sorts on it.
   */
  name: string
  /** Catalog row for the localized label; null when it isn't readable. */
  exercise: ExerciseLabelFields | null
}

/**
 * Options for the history exercise picker.
 *
 * Resolved in two steps rather than with an `exercise:exercises(...)` embed:
 * this query scans every `set_log` the user owns, so an embed would pay the
 * catalog columns thousands of times over to describe a list bounded by the
 * catalog itself (~140 distinct exercises for 3.3k logs today). The second
 * request is off the session path, and the snapshot stays as the fallback for
 * ids the catalog lookup doesn't return.
 */
export function useExerciseHistory() {
  const user = useAtomValue(authAtom)

  return useQuery<ExerciseOption[]>({
    queryKey: ["exercise-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_logs")
        .select("exercise_id, exercise_name_snapshot")

      if (error) throw error

      const rows = data ?? []
      const ids = [...new Set(rows.map((row) => row.exercise_id))]

      // `new Map` keeps the last entry for a duplicate key; reverse so the
      // first snapshot encountered wins, as it did before.
      const snapshotById = new Map(
        rows
          .map((row) => [row.exercise_id, row.exercise_name_snapshot] as const)
          .reverse(),
      )

      const catalog = await fetchExercisesByIds<ExerciseLabelFields>(
        ids,
        LABEL_EXERCISE_SELECT,
      )
      const catalogById = new Map(catalog.map((row) => [row.id, row] as const))

      return ids
        .map((id) => ({
          id,
          name: snapshotById.get(id) ?? "",
          exercise: catalogById.get(id) ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    enabled: !!user,
  })
}
