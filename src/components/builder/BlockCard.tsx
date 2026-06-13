import { useTranslation } from "react-i18next"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Layers, Timer } from "lucide-react"
import type { ExerciseBlockWithExercises } from "@/types/database"
import { Card, CardContent } from "@/components/ui/card"

interface BlockCardProps {
  block: ExerciseBlockWithExercises
}

export function BlockCard({ block }: BlockCardProps) {
  const { t } = useTranslation("builder")
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card ref={setNodeRef} style={style} className="bg-card">
      <CardContent className="flex items-start gap-2 p-3">
        <button
          className="mt-0.5 touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span>{block.label ?? t("blockDefaultLabel")}</span>
            <span className="text-xs text-muted-foreground">
              {t("blockRounds", { count: block.rounds })}
            </span>
          </div>

          <ul className="flex flex-col gap-1">
            {block.exercises.map((be) => (
              <li
                key={be.id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span>{be.emoji_snapshot}</span>
                <span>{be.name_snapshot}</span>
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="h-3 w-3" />
            {t("restShort", { seconds: block.rest_seconds })}
            {block.transition_seconds > 0 && (
              <span>
                {" · "}
                {t("blockTransition", { seconds: block.transition_seconds })}
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
