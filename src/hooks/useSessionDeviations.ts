import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { LABEL_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import {
  mergeSessionDeviations,
  type CatalogName,
  type DebriefAdjustment,
  type DeviationReason,
  type DeviationRow,
  type SessionLogRow,
} from "@/lib/deviationCapture"

type DeviationSelectRow = {
  id: string
  workout_exercise_id: string | null
  exercise_id: string | null
  set_number: number | null
  reason_code: string | null
  note: string | null
}

type LogSelectRow = {
  workout_exercise_id: string | null
  exercise_id: string | null
  set_number: number
  weight_logged: number | null
  prescribed_weight: number | null
  reps_logged: string | null
  prescribed_reps: number | null
  exercise_name_snapshot: string | null
  exercise: CatalogName | null
}

/**
 * S3 debrief read path (T267): the captured deviations for a finished session,
 * joined to their set logs (numbers) and to the catalog (localized name, via
 * ADR 0010). Reads the table — not the offline queue, which is drained before
 * the finish screen renders.
 */
export function useSessionDeviations(
  sessionId: string | null,
  toDisplay: (kg: number) => number,
  unit: string,
) {
  return useQuery<DebriefAdjustment[]>({
    queryKey: ["session-deviations", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const [deviationsRes, logsRes] = await Promise.all([
        supabase
          .from("session_deviation_events")
          .select(
            "id, workout_exercise_id, exercise_id, set_number, reason_code, note",
          )
          .eq("session_id", sessionId)
          .returns<DeviationSelectRow[]>(),
        supabase
          .from("set_logs")
          .select(
            `workout_exercise_id, exercise_id, set_number, weight_logged, prescribed_weight, reps_logged, prescribed_reps, exercise_name_snapshot, exercise:exercises(${LABEL_EXERCISE_SELECT})`,
          )
          .eq("session_id", sessionId)
          .returns<LogSelectRow[]>(),
      ])
      if (deviationsRes.error) throw deviationsRes.error
      if (logsRes.error) throw logsRes.error

      const deviations: DeviationRow[] = (deviationsRes.data ?? []).map(
        (row) => ({
          id: row.id,
          workoutExerciseId: row.workout_exercise_id,
          exerciseId: row.exercise_id,
          setNumber: row.set_number,
          reasonCode: row.reason_code as DeviationReason | null,
          note: row.note,
        }),
      )

      const logs: SessionLogRow[] = (logsRes.data ?? []).map((row) => ({
        workoutExerciseId: row.workout_exercise_id,
        exerciseId: row.exercise_id,
        setNumber: row.set_number,
        weightLogged: row.weight_logged,
        prescribedWeight: row.prescribed_weight,
        repsLogged: row.reps_logged,
        prescribedReps: row.prescribed_reps,
        exerciseNameSnapshot: row.exercise_name_snapshot,
        catalogExercise: row.exercise,
      }))

      return mergeSessionDeviations(deviations, logs, toDisplay, unit)
    },
  })
}
