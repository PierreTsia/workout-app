import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2 } from "lucide-react"
import type { WorkoutExercise } from "@/types/database"
import { Button } from "@/components/ui/button"

interface ExerciseRowProps {
  exercise: WorkoutExercise
  onTap: () => void
  onDelete: () => void
}

export function ExerciseRow({ exercise, onTap, onDelete }: ExerciseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const summary = `${exercise.sets}×${exercise.reps} @ ${exercise.weight}kg`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border bg-card p-3"
    >
      <button
        className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 cursor-pointer" onClick={onTap}>
        <div className="flex items-center gap-2">
          <span className="text-base">{exercise.emoji_snapshot}</span>
          <span className="text-sm font-medium">{exercise.name_snapshot}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {exercise.muscle_snapshot} &middot; {summary}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
