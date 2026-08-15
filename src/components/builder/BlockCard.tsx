import { useTranslation } from "react-i18next"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Layers, Pencil, Timer, Trash2 } from "lucide-react"
import type { ExerciseBlockWithExercises } from "@/types/database"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface BlockCardProps {
  block: ExerciseBlockWithExercises
  onEdit?: () => void
  onDelete?: () => void
}

export function BlockCard({ block, onEdit, onDelete }: BlockCardProps) {
  const { t } = useTranslation("builder")
  const { exerciseName } = useCatalogLabels()
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

  const amrapMinutes =
    block.mode === "amrap" && block.cap_seconds !== null
      ? block.cap_seconds / 60
      : null

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
            <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {block.label ?? t("blockDefaultLabel")}
            </span>
            {amrapMinutes === null && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("blockRounds", { count: block.rounds })}
              </span>
            )}
            <span className="ml-auto flex shrink-0 items-center">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={onEdit}
                  aria-label={t("editBlock")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={onDelete}
                  aria-label={t("remove")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </span>
          </div>

          {amrapMinutes !== null && <AmrapLabel minutes={amrapMinutes} />}

          <ul className="flex flex-col gap-1">
            {block.exercises.map((be) => (
              <li
                key={be.id}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span>{be.emoji_snapshot}</span>
                <span>{exerciseName(be)}</span>
              </li>
            ))}
          </ul>

          {amrapMinutes === null && (
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
          )}
        </div>
      </CardContent>
    </Card>
  )
}
