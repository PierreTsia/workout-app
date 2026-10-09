import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAddExercisesToDay } from "@/hooks/useBuilderMutations"
import type { Exercise } from "@/types/database"

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
