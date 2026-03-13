import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useLastSession } from "@/hooks/useLastSession"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import type { WorkoutExercise } from "@/types/database"
import { ExerciseInstructionsPanel } from "@/components/exercise/ExerciseInstructionsPanel"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { AdminOnly } from "@/components/admin/AdminOnly"
import { SetsTable } from "./SetsTable"

interface ExerciseDetailProps {
  exercise: WorkoutExercise
  sessionId: string
  isReadOnly: boolean
}

export function ExerciseDetail({
  exercise,
  sessionId,
  isReadOnly,
}: ExerciseDetailProps) {
  const { t } = useTranslation("workout")
  const { formatWeight } = useWeightUnit()
  const { data: lastSession } = useLastSession(exercise.exercise_id)
  const { data: libExercise } = useExerciseFromLibrary(exercise.exercise_id)

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ExerciseThumbnail imageUrl={libExercise?.image_url} emoji={exercise.emoji_snapshot} className="h-10 w-10" />
          <h2 className="text-xl font-bold">{exercise.name_snapshot}</h2>
          <AdminOnly>
            <Link
              to={`/admin/exercises/${exercise.exercise_id}`}
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </AdminOnly>
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

      <SetsTable exercise={exercise} sessionId={sessionId} isReadOnly={isReadOnly} />
    </div>
  )
}
