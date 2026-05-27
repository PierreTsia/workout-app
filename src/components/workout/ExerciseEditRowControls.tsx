import { useState } from "react"
import { useTranslation } from "react-i18next"
import { EllipsisVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { ExerciseSwapInlinePanel } from "@/components/workout/ExerciseSwapInlinePanel"
import { ProgressionPill } from "@/components/workout/ProgressionPill"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { formatDurationShort } from "@/lib/formatters"
import type { ProgressionSuggestion } from "@/lib/progression"
import type { ExerciseListItem, WorkoutExercise } from "@/types/database"

export interface ExerciseEditRowControlsProps {
  exercise: WorkoutExercise
  exercisePool: ExerciseListItem[]
  poolLoading: boolean
  currentExerciseIds: string[]
  onSwapExerciseChosen: (row: WorkoutExercise, picked: ExerciseListItem) => void
  onDeleteRequested: (row: WorkoutExercise) => void
  onSwapBrowseLibrary: (row: WorkoutExercise) => void
  onInspectDetails: (exerciseId: string) => void
  /** Pre-session list: opens library sheet. In-session detail uses unified menu instead. */
  showDetailsMenuItem?: boolean
  /**
   * Progression Suggestion for this exercise (#371).
   * - `undefined` while the batched fetch is in flight (combined with `isLoadingSuggestion`).
   * - `null` when there is no Last Performance — falls back to Template Prescription, no pill.
   * - Otherwise drives the displayed weight/reps/duration and a compact pill.
   */
  suggestion?: ProgressionSuggestion | null
  isLoadingSuggestion?: boolean
}

export function ExerciseEditRowControls({
  exercise: ex,
  exercisePool,
  poolLoading,
  currentExerciseIds,
  onSwapExerciseChosen,
  onDeleteRequested,
  onSwapBrowseLibrary,
  onInspectDetails,
  showDetailsMenuItem = true,
  suggestion,
  isLoadingSuggestion = false,
}: ExerciseEditRowControlsProps) {
  const { t } = useTranslation("workout")
  const { formatWeight } = useWeightUnit()
  const [swapPanelOpen, setSwapPanelOpen] = useState(false)

  const showSkeleton = isLoadingSuggestion && suggestion === undefined

  const displayWeight = suggestion ? suggestion.weight : Number(ex.weight)
  const displayDurationSeconds =
    suggestion?.volumeType === "duration"
      ? suggestion.duration
      : ex.target_duration_seconds
  const displayReps =
    suggestion?.volumeType === "reps" ? String(suggestion.reps) : ex.reps

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={poolLoading}
          aria-label={t("preSession.rowActionsLabel")}
        >
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showDetailsMenuItem ? (
          <DropdownMenuItem onClick={() => onInspectDetails(ex.exercise_id)}>
            {t("preSession.details")}
          </DropdownMenuItem>
        ) : null}
        {showDetailsMenuItem ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem
          onClick={() => setSwapPanelOpen((v) => !v)}
        >
          {t("preSession.swap")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => onDeleteRequested(ex)}
        >
          {t("preSession.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const swapPanel =
    swapPanelOpen && (
      <ExerciseSwapInlinePanel
        className="pl-1"
        exercise={ex}
        exercisePool={exercisePool}
        currentExerciseIds={currentExerciseIds}
        onSwapExerciseChosen={onSwapExerciseChosen}
        onSwapBrowseLibrary={onSwapBrowseLibrary}
        onDismiss={() => setSwapPanelOpen(false)}
      />
    )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
        <span className="text-2xl leading-none">{ex.emoji_snapshot}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {ex.name_snapshot}
          </p>
          {showSkeleton ? (
            <Skeleton
              data-testid="progression-suggestion-skeleton"
              className="mt-0.5 h-4 w-32"
            />
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>
                {ex.sets} ×{" "}
                {displayDurationSeconds != null && displayDurationSeconds > 0
                  ? formatDurationShort(displayDurationSeconds)
                  : displayReps}
                {displayWeight > 0 && ` · ${formatWeight(displayWeight)}`}
              </span>
              {suggestion ? (
                <ProgressionPill suggestion={suggestion} compact />
              ) : null}
            </div>
          )}
        </div>
        {menu}
      </div>
      {swapPanel}
    </div>
  )
}
