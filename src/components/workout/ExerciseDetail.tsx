import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { useLastSession } from "@/hooks/useLastSession"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import type { WorkoutExercise } from "@/types/database"
import { ExerciseInstructionsPanel } from "@/components/exercise/ExerciseInstructionsPanel"
import { SetsTable } from "./SetsTable"

interface ExerciseDetailProps {
  exercise: WorkoutExercise
  sessionId: string
}

export function ExerciseDetail({ exercise, sessionId }: ExerciseDetailProps) {
  const { t } = useTranslation("workout")
  const { formatWeight } = useWeightUnit()
  const { data: lastSession } = useLastSession(exercise.exercise_id)

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{exercise.emoji_snapshot}</span>
          <h2 className="text-xl font-bold">{exercise.name_snapshot}</h2>
        </div>
        <Badge variant="secondary" className="w-fit text-xs">
          {exercise.muscle_snapshot}
        </Badge>
        {lastSession && (
          <p className="text-sm text-muted-foreground">
            {t("lastTime", {
              sets: lastSession.sets,
              reps: lastSession.reps,
              weight: formatWeight(lastSession.weight),
            })}
          </p>
        )}
      </div>

      <ExerciseInstructionsPanel exerciseId={exercise.exercise_id} />

      <SetsTable exercise={exercise} sessionId={sessionId} />
    </div>
  )
}
