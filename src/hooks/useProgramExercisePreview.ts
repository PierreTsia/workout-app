import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import {
  flattenProgramExercisePreview,
  type ProgramExercisePreviewItem,
} from "@/lib/profile/programExercisePreview"

const PREVIEW_SELECT =
  "sort_order, workout_exercises(exercise_id, name_snapshot, emoji_snapshot, sort_order), exercise_blocks(sort_order, exercises:block_exercises(exercise_id, name_snapshot, emoji_snapshot, position))"

export function useProgramExercisePreview(
  programId: string | null,
  enabled: boolean,
) {
  return useQuery<ProgramExercisePreviewItem[]>({
    queryKey: ["program-exercise-preview", programId],
    queryFn: async () => {
      if (programId == null) {
        throw new Error("useProgramExercisePreview: programId is required")
      }
      const { data, error } = await supabase
        .from("workout_days")
        .select(PREVIEW_SELECT)
        .eq("program_id", programId)
        .order("sort_order")

      if (error) throw error
      return flattenProgramExercisePreview(data)
    },
    enabled: Boolean(programId) && enabled,
  })
}
