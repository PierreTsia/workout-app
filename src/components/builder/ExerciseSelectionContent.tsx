import { useMemo, useState, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAddExercisesToDay } from "@/hooks/useBuilderMutations"
import type { Exercise } from "@/types/database"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { ExerciseInfoDialog } from "@/components/exercise/ExerciseInfoDialog"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { getDifficultyColor } from "@/lib/difficulty"
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

/** Minimal shape for an existing day exercise (library id + row id). */
export interface ExistingDayExercise {
  exercise_id: string
  id: string
}

export interface ExerciseSelectionContentProps {
  initialSelectedIds: string[]
  existingExercises: ExistingDayExercise[]
  existingSet: Set<string>
  grouped: Record<string, Exercise[]> | undefined
  dayId: string
  existingExerciseCount: number
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
  onClose: () => void
  addExercises: ReturnType<typeof useAddExercisesToDay>
  /** When provided, the picker creates a Circuit from the selected exercises instead of adding solos. */
  onCreateBlock?: (selected: Exercise[]) => Promise<void> | void
}

export function useExerciseSelection({
  existingSet,
  grouped,
  dayId,
  existingExerciseCount,
  onMutationStateChange,
  onClose,
  addExercises,
  onCreateBlock,
}: ExerciseSelectionContentProps) {
  const { t } = useTranslation("builder")
  const isBlockMode = !!onCreateBlock

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  /**
   * Keeps full Exercise rows for every exercise the user toggles ON, so a
   * filter/search that hides a selected row never drops it from the pending
   * additions (create CTA *and* Add N both depend on this).
   */
  const [selectedById, setSelectedById] = useState<Map<string, Exercise>>(
    () => new Map(),
  )
  const [isCreatingBlock, setIsCreatingBlock] = useState(false)

  const toggleSelected = useCallback(
    (ex: Exercise) => {
      if (!isBlockMode && existingSet.has(ex.id)) return
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(ex.id)) next.delete(ex.id)
        else next.add(ex.id)
        return next
      })
      setSelectedById((prev) => {
        const next = new Map(prev)
        if (next.has(ex.id)) next.delete(ex.id)
        else next.set(ex.id, ex)
        return next
      })
    },
    [existingSet, isBlockMode],
  )

  const toAdd = useMemo(
    () =>
      [...selectedById.values()].filter(
        (ex) => selectedIds.has(ex.id) && !existingSet.has(ex.id),
      ),
    [selectedById, selectedIds, existingSet],
  )

  const selectedExercises = useMemo(
    () =>
      [...selectedById.values()].filter((ex) => selectedIds.has(ex.id)),
    [selectedById, selectedIds],
  )

  const hasChanges = toAdd.length > 0
  const canCreateBlock = selectedExercises.length >= 2

  async function handleCreateBlock() {
    if (!onCreateBlock || !canCreateBlock) return
    onMutationStateChange("saving")
    setIsCreatingBlock(true)
    try {
      await onCreateBlock(selectedExercises)
      onMutationStateChange("saved")
      onClose()
    } catch {
      onMutationStateChange("error")
    } finally {
      setIsCreatingBlock(false)
    }
  }

  async function handleApply() {
    if (!hasChanges) return
    onMutationStateChange("saving")
    try {
      await addExercises.mutateAsync({
        dayId,
        exercises: toAdd,
        startSortOrder: existingExerciseCount,
      })
      onMutationStateChange("saved")
      onClose()
    } catch {
      onMutationStateChange("error")
    }
  }

  const isApplying = addExercises.isPending

  return {
    t,
    isBlockMode,
    selectedIds,
    toggleSelected,
    grouped,
    existingSet,
    canCreateBlock,
    hasChanges,
    addCount: toAdd.length,
    isCreatingBlock,
    isApplying,
    selectedExercises,
    handleCreateBlock,
    handleApply,
  }
}

export type ExerciseSelectionState = ReturnType<typeof useExerciseSelection>

export function ExerciseSelectionList({
  state,
}: {
  state: ExerciseSelectionState
}) {
  const { t, selectedIds, toggleSelected, grouped, isBlockMode, existingSet } =
    state
  const { catalogName, muscleLabel } = useCatalogLabels()

  return (
    <>
      <CommandEmpty>{t("noExercisesFound")}</CommandEmpty>
      {grouped &&
        Object.entries(grouped).map(([muscle, exList]) => (
          <CommandGroup key={muscle} heading={muscleLabel(muscle)}>
            {exList.map((ex) => {
              const lockedOnDay = !isBlockMode && existingSet.has(ex.id)
              return (
              <CommandItem
                key={ex.id}
                // Both spellings of both fields, so searching matches what the
                // reader sees *and* what a French user has always typed.
                value={`${ex.name} ${ex.name_en ?? ""} ${ex.muscle_group} ${muscleLabel(ex.muscle_group)}`}
                onSelect={() => {}}
                className={cn(
                  "flex items-center justify-between gap-2",
                  lockedOnDay && "opacity-70",
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  {lockedOnDay ? (
                    <Badge
                      variant="outline"
                      className="h-5 shrink-0 px-1.5 text-[10px] uppercase tracking-wider"
                    >
                      {t("alreadyInDay")}
                    </Badge>
                  ) : (
                    <Checkbox
                      checked={selectedIds.has(ex.id)}
                      onCheckedChange={() => toggleSelected(ex)}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label={t("add")}
                      className="shrink-0"
                    />
                  )}
                  <ExerciseThumbnail
                    imageUrl={ex.image_url}
                    emoji={ex.emoji}
                    className="h-8 w-8 shrink-0 rounded-md"
                  />
                  <span className="truncate">{catalogName(ex)}</span>
                  {ex.difficulty_level && (
                    <Badge
                      className={cn(
                        "h-5 shrink-0 px-1.5 text-[10px] border-0",
                        getDifficultyColor(ex.difficulty_level),
                      )}
                    >
                      {t(`difficulty.${ex.difficulty_level}`, ex.difficulty_level)}
                    </Badge>
                  )}
                </span>
                <span
                  className="flex shrink-0 items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <ExerciseInfoDialog exercise={ex} />
                  <FeedbackTrigger
                    exerciseId={ex.id}
                    sourceScreen="library_picker"
                  />
                </span>
              </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
    </>
  )
}

/** Pinned below the scrollable list — always visible even when filters shrink the viewport. */
export function ExerciseSelectionActions({
  state,
}: {
  state: ExerciseSelectionState
}) {
  const {
    t,
    isBlockMode,
    canCreateBlock,
    addCount,
    isCreatingBlock,
    isApplying,
    selectedExercises,
    handleCreateBlock,
    handleApply,
  } = state

  if (isBlockMode) {
    return (
      <div className="shrink-0 border-t bg-popover p-3">
        <Button
          className="w-full"
          onClick={handleCreateBlock}
          disabled={!canCreateBlock || isCreatingBlock}
        >
          {isCreatingBlock ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {t("createBlockCta", { count: selectedExercises.length })}
        </Button>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t bg-popover p-3">
      <Button
        className="w-full"
        onClick={handleApply}
        disabled={addCount === 0 || isApplying}
      >
        {isApplying ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {t("addSelectedCount", { count: addCount })}
      </Button>
    </div>
  )
}

/** Selection state + list + apply. Keyed by parent so it remounts with fresh initial selection (no setState-in-effect). */
export function ExerciseSelectionContent(props: ExerciseSelectionContentProps) {
  const state = useExerciseSelection(props)
  return (
    <>
      <ExerciseSelectionList state={state} />
      <ExerciseSelectionActions state={state} />
    </>
  )
}
