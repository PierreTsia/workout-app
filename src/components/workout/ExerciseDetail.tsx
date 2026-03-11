import { Badge } from "@/components/ui/badge"
import { useLastSession } from "@/hooks/useLastSession"
import type { WorkoutExercise } from "@/types/database"
import { SetsTable } from "./SetsTable"

interface ExerciseDetailProps {
  exercise: WorkoutExercise
  sessionId: string
}

export function ExerciseDetail({ exercise, sessionId }: ExerciseDetailProps) {
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
            Last time: {lastSession.sets} &times; {lastSession.reps} @{" "}
            {lastSession.weight} kg
          </p>
        )}
      </div>

      <SetsTable exercise={exercise} sessionId={sessionId} />
    </div>
  )
}
