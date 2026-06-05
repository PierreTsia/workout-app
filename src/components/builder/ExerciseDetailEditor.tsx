import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { ExerciseDetailForm } from "./ExerciseDetailForm"

interface ExerciseDetailEditorProps {
  dayId: string
  exerciseId: string
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

/**
 * Fetches the exercise + its library entry and gates rendering until the
 * exercise is found and the library lookup has settled (resolved or
 * confirmed-absent — `libExercise` may legitimately be `undefined` for an
 * exercise no longer in the catalog). Then mounts {@link ExerciseDetailForm}
 * keyed on exercise + unit so the form's lazy seed reflects the persisted
 * prescription.
 */
export function ExerciseDetailEditor({
  dayId,
  exerciseId,
  onMutationStateChange,
}: ExerciseDetailEditorProps) {
  const { unit } = useWeightUnit()
  const { data: exercises } = useWorkoutExercises(dayId)
  const exercise = exercises?.find((e) => e.id === exerciseId)
  const { data: libExercise, isLoading: libLoading } = useExerciseFromLibrary(
    exercise?.exercise_id ?? "",
  )

  if (!exercise || libLoading) return null

  return (
    <ExerciseDetailForm
      key={`${exercise.id}:${unit}`}
      exercise={exercise}
      libExercise={libExercise}
      onMutationStateChange={onMutationStateChange}
    />
  )
}
