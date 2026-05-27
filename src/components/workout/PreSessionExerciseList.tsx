import { useTranslation } from "react-i18next"
import { AlertCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExerciseEditRowControls } from "@/components/workout/ExerciseEditRowControls"
import type { ProgressionSuggestion } from "@/lib/progression"
import type { ExerciseListItem, WorkoutExercise } from "@/types/database"

export interface PreSessionExerciseListProps {
  exercises: WorkoutExercise[]
  /** Slim pool from `useExerciseLibrary` — rich fields (instructions/youtube) are fetched on demand in inspect sheets. */
  exercisePool: ExerciseListItem[]
  poolLoading: boolean
  onSwapExerciseChosen: (row: WorkoutExercise, picked: ExerciseListItem) => void
  onDeleteRequested: (row: WorkoutExercise) => void
  onSwapBrowseLibrary: (row: WorkoutExercise) => void
  onRequestAddExerciseSheet: () => void
  onInspectExercise: (exerciseId: string) => void
  /**
   * Map of `exercise_id → ProgressionSuggestion | null` for #371.
   * - Missing key (`undefined`) combined with `suggestionsLoading=true` → row shows skeleton.
   * - `null` → row falls back to **Template Prescription**, no pill.
   * - Otherwise → row renders engine values + compact `ProgressionPill`.
   */
  suggestionsByExerciseId?: Map<string, ProgressionSuggestion | null>
  suggestionsLoading?: boolean
  suggestionsError?: Error | null
}

export function PreSessionExerciseList({
  exercises,
  exercisePool,
  poolLoading,
  onSwapExerciseChosen,
  onDeleteRequested,
  onRequestAddExerciseSheet,
  onSwapBrowseLibrary,
  onInspectExercise,
  suggestionsByExerciseId,
  suggestionsLoading = false,
  suggestionsError = null,
}: PreSessionExerciseListProps) {
  const { t } = useTranslation("workout")

  const currentExerciseIds = exercises.map((e) => e.exercise_id)

  return (
    <div className="flex flex-col gap-2">
      {suggestionsError ? (
        <div
          role="status"
          className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"
        >
          <AlertCircle className="h-3 w-3" aria-hidden />
          <span>{t("progression.suggestionsUnavailable")}</span>
        </div>
      ) : null}

      {exercises.map((ex) => (
        <ExerciseEditRowControls
          key={ex.id}
          exercise={ex}
          exercisePool={exercisePool}
          poolLoading={poolLoading}
          currentExerciseIds={currentExerciseIds}
          onSwapExerciseChosen={onSwapExerciseChosen}
          onDeleteRequested={onDeleteRequested}
          onSwapBrowseLibrary={onSwapBrowseLibrary}
          onInspectDetails={onInspectExercise}
          suggestion={suggestionsByExerciseId?.get(ex.exercise_id)}
          isLoadingSuggestion={suggestionsLoading}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={onRequestAddExerciseSheet}
      >
        <Plus className="h-4 w-4" />
        {t("preSession.addExercise")}
      </Button>
    </div>
  )
}
