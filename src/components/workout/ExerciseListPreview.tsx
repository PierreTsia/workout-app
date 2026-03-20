import type { WorkoutExercise } from "@/types/database"
import { useWeightUnit } from "@/hooks/useWeightUnit"

interface ExerciseListPreviewProps {
  exercises: WorkoutExercise[]
}

export function ExerciseListPreview({ exercises }: ExerciseListPreviewProps) {
  const { formatWeight } = useWeightUnit()

  if (exercises.length === 0) return null

  return (
    <div className="space-y-2">
      {exercises.map((ex) => (
        <div
          key={ex.id}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3"
        >
          <span className="text-2xl leading-none">{ex.emoji_snapshot}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {ex.name_snapshot}
            </p>
            <p className="text-xs text-muted-foreground">
              {ex.sets} × {ex.reps}
              {Number(ex.weight) > 0 && ` · ${formatWeight(Number(ex.weight))}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
