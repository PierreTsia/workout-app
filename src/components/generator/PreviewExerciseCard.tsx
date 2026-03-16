import { useTranslation } from "react-i18next"
import { X, ArrowLeftRight, CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GeneratedExercise } from "@/types/generator"

interface PreviewExerciseCardProps {
  item: GeneratedExercise
  index: number
  onRemove: (index: number) => void
  onSwap: (index: number) => void
  onInfo: (index: number) => void
  onUpdateSets: (index: number, sets: number) => void
  onUpdateReps: (index: number, reps: string) => void
}

export function PreviewExerciseCard({
  item,
  index,
  onRemove,
  onSwap,
  onInfo,
  onUpdateSets,
  onUpdateReps,
}: PreviewExerciseCardProps) {
  const { t } = useTranslation("generator")

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <button
        type="button"
        className="text-xl"
        onClick={() => onInfo(index)}
      >
        {item.exercise.emoji}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          className="flex items-center gap-1 text-left"
          onClick={() => onInfo(index)}
        >
          <span className="truncate text-sm font-medium">
            {item.exercise.name}
          </span>
          <CircleHelp className="h-4 w-4 shrink-0 text-primary" />
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">
            {item.exercise.muscle_group}
          </span>
          <span>{item.isCompound ? t("compound") : t("isolation")}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdateSets(index, Math.max(1, item.sets - 1))}
            className="h-6 w-6 rounded border text-xs font-medium hover:bg-accent"
          >
            −
          </button>
          <span className="text-xs font-medium">
            {item.sets} × {item.reps}
          </span>
          <button
            type="button"
            onClick={() => onUpdateSets(index, item.sets + 1)}
            className="h-6 w-6 rounded border text-xs font-medium hover:bg-accent"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              const cycle = ["6", "8", "10", "12", "15", "20"]
              const currentIdx = cycle.indexOf(item.reps)
              const nextIdx = (currentIdx + 1) % cycle.length
              onUpdateReps(index, cycle[nextIdx])
            }}
            className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            {t("changeReps")}
          </button>
          <span className="text-xs text-muted-foreground">
            {item.restSeconds}s {t("rest")}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onSwap(index)}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onRemove(index)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
