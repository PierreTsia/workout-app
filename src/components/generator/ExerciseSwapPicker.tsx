import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import type { Exercise } from "@/types/database"

interface ExerciseSwapPickerProps {
  pool: Exercise[]
  currentExerciseIds: string[]
  muscleGroup: string
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}

export function ExerciseSwapPicker({
  pool,
  currentExerciseIds,
  muscleGroup,
  onSelect,
  onClose,
}: ExerciseSwapPickerProps) {
  const { t } = useTranslation("generator")

  const candidates = useMemo(
    () =>
      pool.filter(
        (e) =>
          e.muscle_group === muscleGroup && !currentExerciseIds.includes(e.id),
      ),
    [pool, muscleGroup, currentExerciseIds],
  )

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("swapTitle")}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("cancel")}
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {t("noSwapCandidates")}
        </p>
      ) : (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {candidates.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => onSelect(exercise)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
              )}
            >
              <span>{exercise.emoji}</span>
              <span className="truncate">{exercise.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
