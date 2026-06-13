import { useTranslation } from "react-i18next"
import { AlertCircle, Plus } from "lucide-react"
import type { PostgrestError } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { ExerciseEditRowControls } from "@/components/workout/ExerciseEditRowControls"
import { BlockSessionCard } from "@/components/workout/BlockSessionCard"
import { buildSessionItems } from "@/lib/sessionItems"
import type { ProgressionSuggestion } from "@/lib/progression"
import type {
  ExerciseBlockWithExercises,
  ExerciseListItem,
  WorkoutExercise,
} from "@/types/database"

export interface PreSessionExerciseListProps {
  exercises: WorkoutExercise[]
  /** Blocks for the day — rendered read-only, interleaved with solos by sort_order (#351). */
  blocks?: ExerciseBlockWithExercises[]
  /** Slim pool from `useExerciseLibrary` — rich fields (instructions/youtube) are fetched on demand in inspect sheets. */
  exercisePool: ExerciseListItem[]
  poolLoading: boolean
  onSwapExerciseChosen: (row: WorkoutExercise, picked: ExerciseListItem) => void
  onDeleteRequested: (row: WorkoutExercise) => void
  onSwapBrowseLibrary: (row: WorkoutExercise) => void
  onRequestAddExerciseSheet: () => void
  onInspectExercise: (exerciseId: string) => void
  /**
   * Map of `workout_exercises.id → ProgressionSuggestion | null` for #371.
   * Keyed by row id (not exercise_id) so two rows of the same exercise stay
   * independent.
   * - Missing key (`undefined`) combined with `suggestionsLoading=true` → row shows skeleton.
   * - `null` → row falls back to **Template Prescription**, no pill.
   * - Otherwise → row renders engine values + compact `ProgressionPill`.
   */
  suggestionsByRowId?: Map<string, ProgressionSuggestion | null>
  suggestionsLoading?: boolean
  suggestionsError?: PostgrestError | null
}

export function PreSessionExerciseList({
  exercises,
  blocks = [],
  exercisePool,
  poolLoading,
  onSwapExerciseChosen,
  onDeleteRequested,
  onRequestAddExerciseSheet,
  onSwapBrowseLibrary,
  onInspectExercise,
  suggestionsByRowId,
  suggestionsLoading = false,
  suggestionsError = null,
}: PreSessionExerciseListProps) {
  const { t } = useTranslation("workout")

  const currentExerciseIds = exercises.map((e) => e.exercise_id)
  const items = buildSessionItems(exercises, blocks)

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

      {items.map((item) =>
        item.kind === "block" ? (
          <BlockSessionCard key={`block-${item.block.id}`} block={item.block} />
        ) : (
          <ExerciseEditRowControls
            key={item.exercise.id}
            exercise={item.exercise}
            exercisePool={exercisePool}
            poolLoading={poolLoading}
            currentExerciseIds={currentExerciseIds}
            onSwapExerciseChosen={onSwapExerciseChosen}
            onDeleteRequested={onDeleteRequested}
            onSwapBrowseLibrary={onSwapBrowseLibrary}
            onInspectDetails={onInspectExercise}
            suggestion={suggestionsByRowId?.get(item.exercise.id)}
            isLoadingSuggestion={suggestionsLoading}
          />
        ),
      )}

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
