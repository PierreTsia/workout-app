import type { WorkoutExercise } from "@/types/database"

interface ExerciseListPreviewProps {
  exercises: WorkoutExercise[]
  maxItems?: number
}

export function ExerciseListPreview({
  exercises,
  maxItems = 5,
}: ExerciseListPreviewProps) {
  const visible = exercises.slice(0, maxItems)
  const remaining = exercises.length - visible.length

  return (
    <ul className="space-y-1.5">
      {visible.map((ex) => (
        <li key={ex.id} className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-base leading-none">
            {ex.emoji_snapshot}
          </span>
          <span className="truncate text-foreground">{ex.name_snapshot}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {ex.sets}×{ex.reps}
          </span>
        </li>
      ))}
      {remaining > 0 && (
        <li className="text-xs text-muted-foreground">
          +{remaining} more
        </li>
      )}
    </ul>
  )
}
