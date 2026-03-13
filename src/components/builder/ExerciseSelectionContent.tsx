import { useMemo, useState, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  useAddExercisesToDay,
  useDeleteExercise,
} from "@/hooks/useBuilderMutations"
import type { Exercise } from "@/types/database"
import { ExerciseInfoDialog } from "@/components/exercise/ExerciseInfoDialog"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"

/** Minimal shape for an existing day exercise (library id + row id for delete) */
export interface ExistingDayExercise {
  exercise_id: string
  id: string
}

export interface ExerciseSelectionContentProps {
  initialSelectedIds: string[]
  existingExercises: ExistingDayExercise[]
  existingSet: Set<string>
  filtered: Exercise[] | undefined
  grouped: Record<string, Exercise[]> | undefined
  dayId: string
  existingExerciseCount: number
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
  onClose: () => void
  addExercises: ReturnType<typeof useAddExercisesToDay>
  deleteExercise: ReturnType<typeof useDeleteExercise>
}

/** Selection state + list + apply. Keyed by parent so it remounts with fresh initial selection (no setState-in-effect). */
export function ExerciseSelectionContent({
  initialSelectedIds,
  existingExercises,
  existingSet,
  filtered,
  grouped,
  dayId,
  existingExerciseCount,
  onMutationStateChange,
  onClose,
  addExercises,
  deleteExercise,
}: ExerciseSelectionContentProps) {
  const { t } = useTranslation("builder")

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds),
  )

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toAdd = useMemo(() => {
    if (!filtered) return []
    return filtered.filter(
      (ex) => selectedIds.has(ex.id) && !existingSet.has(ex.id),
    )
  }, [filtered, selectedIds, existingSet])

  const toRemove = useMemo(
    () =>
      existingExercises.filter((e) => !selectedIds.has(e.exercise_id)),
    [existingExercises, selectedIds],
  )

  const hasChanges = toAdd.length > 0 || toRemove.length > 0

  async function handleApply() {
    if (!hasChanges) return
    onMutationStateChange("saving")
    try {
      if (toAdd.length > 0) {
        await addExercises.mutateAsync({
          dayId,
          exercises: toAdd,
          startSortOrder: existingExerciseCount,
        })
      }
      await Promise.all(
        toRemove.map((e) =>
          deleteExercise.mutateAsync({ id: e.id, dayId }),
        ),
      )
      onMutationStateChange("saved")
      onClose()
    } catch {
      onMutationStateChange("error")
    }
  }

  const isApplying =
    addExercises.isPending || deleteExercise.isPending

  return (
    <>
      <CommandEmpty>{t("noExercisesFound")}</CommandEmpty>
      {grouped &&
        Object.entries(grouped).map(([muscle, exList]) => (
          <CommandGroup key={muscle} heading={muscle}>
            {exList.map((ex) => (
              <CommandItem
                key={ex.id}
                value={`${ex.name} ${ex.name_en ?? ""} ${ex.muscle_group}`}
                onSelect={() => {}}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Checkbox
                    checked={selectedIds.has(ex.id)}
                    onCheckedChange={() => toggleSelected(ex.id)}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label={t("add")}
                    className="shrink-0"
                  />
                  <ExerciseThumbnail
                    imageUrl={ex.image_url}
                    emoji={ex.emoji}
                    className="h-8 w-8 shrink-0 rounded-md"
                  />
                  <span className="truncate">{ex.name}</span>
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
            ))}
          </CommandGroup>
        ))}
      {hasChanges && (
        <div className="shrink-0 border-t p-3">
          <Button
            className="w-full"
            onClick={handleApply}
            disabled={isApplying}
          >
            {isApplying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("applyChanges")}
          </Button>
        </div>
      )}
    </>
  )
}
