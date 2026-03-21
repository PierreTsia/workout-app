import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExerciseEditRowControls } from "@/components/workout/ExerciseEditRowControls"
import type { Exercise, WorkoutExercise } from "@/types/database"

export interface PreSessionExerciseListProps {
  exercises: WorkoutExercise[]
  exercisePool: Exercise[]
  poolLoading: boolean
  onSwapExerciseChosen: (row: WorkoutExercise, picked: Exercise) => void
  onDeleteRequested: (row: WorkoutExercise) => void
  onSwapBrowseLibrary: (row: WorkoutExercise) => void
  onRequestAddExerciseSheet: () => void
  onInspectExercise: (exerciseId: string) => void
}

export function PreSessionExerciseList({
  exercises,
  exercisePool,
  poolLoading,
  onSwapExerciseChosen,
  onDeleteRequested,
  onRequestAddExerciseSheet,
  onSwapBrowseLibrary,
  onInspectExercise,
}: PreSessionExerciseListProps) {
  const { t } = useTranslation("workout")

  const currentExerciseIds = exercises.map((e) => e.exercise_id)

  return (
    <div className="space-y-2">
      {exercises.map((ex) => (
        <ExerciseEditRowControls
          key={ex.id}
          exercise={ex}
          exercisePool={exercisePool}
          poolLoading={poolLoading}
          currentExerciseIds={currentExerciseIds}
          onSwapExerciseChosen={onSwapExerciseChosen}
          onDeleteRequested={onDeleteRequested}
          onSwapBrowseLibrary={onSwapBrowseLibrary}
          onInspectDetails={onInspectExercise}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={onRequestAddExerciseSheet}
      >
        <Plus className="h-4 w-4" />
        {t("preSession.addExercise")}
      </Button>
    </div>
  )
}
