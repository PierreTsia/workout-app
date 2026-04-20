import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Info } from "lucide-react"
import { ExerciseDetailSheet } from "@/components/generator/ExerciseDetailSheet"
import { useExerciseById } from "@/hooks/useExerciseById"
import { cn } from "@/lib/utils"
import type { ExerciseListItem } from "@/types/database"

interface ExerciseSwapPickerProps {
  pool: ExerciseListItem[]
  currentExerciseIds: string[]
  muscleGroup: string
  onSelect: (exercise: ExerciseListItem) => void
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
  const [inspectedExerciseId, setInspectedExerciseId] = useState<string | null>(null)
  // Rich fields (instructions/youtube) deferred until the user opens the info
  // sheet. Hits the per-id cache seeded by `useWorkoutExercises` when the
  // exercise is in the current day — otherwise fires a single `select(*)`.
  const { data: inspectedExercise } = useExerciseById(inspectedExerciseId)

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
            <div key={exercise.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(exercise)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                )}
              >
                <span>{exercise.emoji}</span>
                <span className="truncate">{exercise.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectedExerciseId(exercise.id)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={t("exerciseInfo", "View details")}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <ExerciseDetailSheet
        exercise={inspectedExercise ?? null}
        open={!!inspectedExerciseId}
        onOpenChange={(v) => {
          if (!v) setInspectedExerciseId(null)
        }}
      />
    </div>
  )
}
