import { useTranslation } from "react-i18next"
import { X, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GeneratedExercise } from "@/types/generator"

interface PreviewExerciseCardProps {
  item: GeneratedExercise
  index: number
  onRemove: (index: number) => void
  onSwap: (index: number) => void
  onUpdateSets: (index: number, sets: number) => void
  onUpdateReps: (index: number, reps: string) => void
}

export function PreviewExerciseCard({
  item,
  index,
  onRemove,
  onSwap,
  onUpdateSets,
  onUpdateReps,
}: PreviewExerciseCardProps) {
  const { t } = useTranslation("generator")

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <span className="text-xl">{item.exercise.emoji}</span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">
          {item.exercise.name}
        </span>
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
              const newReps = item.isCompound ? "8-10" : "12-15"
              const current = item.reps
              if (current === "8-10") onUpdateReps(index, "6-8")
              else if (current === "6-8") onUpdateReps(index, "10-12")
              else if (current === "12-15") onUpdateReps(index, "10-12")
              else if (current === "10-12") onUpdateReps(index, "15-20")
              else onUpdateReps(index, newReps)
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
