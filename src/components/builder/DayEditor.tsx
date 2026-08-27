import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Loader2, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { useDayItems } from "@/hooks/useDayItems"
import {
  useCreateBlock,
  useReorderBlocks,
  useDeleteBlock,
} from "@/hooks/useBlockMutations"
import {
  useUpdateDay,
  useDeleteExercise,
  useReorderExercises,
} from "@/hooks/useBuilderMutations"
import { dayItemId, dayItemSortUpdates, moveDayItems } from "@/lib/dayItems"
import { toIntentDayFromDayItems } from "@/lib/programScore/toIntentDayFromDayItems"
import type { Exercise, WorkoutExerciseWithExercise } from "@/types/database"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DayEditorSkeleton } from "./DayEditorSkeleton"
import { DayIntentMap } from "./DayIntentMap"
import { ExerciseRow } from "./ExerciseRow"
import { ExerciseLibraryPicker } from "./ExerciseLibraryPicker"
import { BlockCard } from "./BlockCard"
import { BlockEditor } from "./BlockEditor"

interface DayEditorProps {
  programId: string
  dayId: string
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function DayEditor({
  programId,
  dayId,
  onMutationStateChange,
}: DayEditorProps) {
  const { t } = useTranslation("builder")
  const { exerciseName } = useCatalogLabels()
  const { data: days } = useWorkoutDays(programId)
  const { items: dayItems, isLoading } = useDayItems(dayId)
  const updateDay = useUpdateDay(programId)
  const deleteExercise = useDeleteExercise()
  const reorderExercises = useReorderExercises()
  const reorderBlocks = useReorderBlocks()
  const createBlock = useCreateBlock()
  const deleteBlock = useDeleteBlock()

  const day = days?.find((d) => d.id === dayId)

  const [label, setLabel] = useState(day?.label ?? "")
  const [trackedDayId, setTrackedDayId] = useState(dayId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editBlockId, setEditBlockId] = useState<string | null>(null)
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<WorkoutExerciseWithExercise | null>(null)
  const [pendingOrder, setPendingOrder] = useState<typeof dayItems | null>(null)

  if (dayId !== trackedDayId) {
    setTrackedDayId(dayId)
    setLabel(day?.label ?? "")
    setPendingOrder(null)
  }

  const displayItems = pendingOrder ?? dayItems

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleLabelChange = useCallback(
    (value: string) => {
      setLabel(value)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onMutationStateChange("saving")
        updateDay.mutate(
          { id: dayId, label: value },
          {
            onSuccess: () => onMutationStateChange("saved"),
            onError: () => onMutationStateChange("error"),
          },
        )
      }, 500)
    },
    [dayId, updateDay, onMutationStateChange],
  )

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const nextItems = moveDayItems(
      displayItems,
      String(active.id),
      String(over.id),
    )
    if (nextItems === displayItems) return

    const { solos, blocks } = dayItemSortUpdates(nextItems)
    setPendingOrder(nextItems)
    onMutationStateChange("saving")
    try {
      await Promise.all([
        solos.length > 0
          ? reorderExercises.mutateAsync({ dayId, exercises: solos })
          : Promise.resolve(),
        blocks.length > 0
          ? reorderBlocks.mutateAsync({ dayId, blocks })
          : Promise.resolve(),
      ])
      onMutationStateChange("saved")
    } catch {
      onMutationStateChange("error")
    } finally {
      setPendingOrder(null)
    }
  }

  function confirmDeleteExercise() {
    if (!deleteTarget) return
    onMutationStateChange("saving")
    deleteExercise.mutate(
      { id: deleteTarget.id, dayId },
      {
        onSuccess: () => {
          onMutationStateChange("saved")
          setDeleteTarget(null)
        },
        onError: () => {
          onMutationStateChange("error")
          setDeleteTarget(null)
        },
      },
    )
  }

  const existingMaxSortOrder = displayItems.reduce(
    (max, item) => Math.max(max, item.sort_order),
    -1,
  )

  async function handleCreateBlock(selected: Exercise[]) {
    await createBlock.mutateAsync({
      dayId,
      libraryExercises: selected,
      existingMaxSortOrder,
    })
  }

  function confirmDeleteBlock() {
    if (!deleteBlockId) return
    onMutationStateChange("saving")
    deleteBlock.mutate(
      { blockId: deleteBlockId, dayId },
      {
        onSuccess: () => {
          onMutationStateChange("saved")
          setDeleteBlockId(null)
        },
        onError: () => {
          onMutationStateChange("error")
          setDeleteBlockId(null)
        },
      },
    )
  }

  const soloItems = useMemo(
    () => displayItems.flatMap((i) => (i.kind === "solo" ? [i.exercise] : [])),
    [displayItems],
  )
  const blocks = displayItems.flatMap((i) =>
    i.kind === "block" ? [i.block] : [],
  )

  if (isLoading) {
    return <DayEditorSkeleton />
  }

  const editBlock = blocks.find((b) => b.id === editBlockId) ?? null
  const deleteBlockTarget = blocks.find((b) => b.id === deleteBlockId) ?? null
  const intentDay = toIntentDayFromDayItems(
    { id: dayId, label, sortOrder: day?.sort_order ?? 0 },
    displayItems,
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <Input
        value={label}
        onChange={(e) => handleLabelChange(e.target.value)}
        placeholder={t("dayName")}
        className="text-lg font-semibold"
      />

      <DayIntentMap day={intentDay} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displayItems.map(dayItemId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {displayItems.map((item) =>
              item.kind === "solo" ? (
                <ExerciseRow
                  key={item.exercise.id}
                  exercise={item.exercise}
                  onDelete={() => setDeleteTarget(item.exercise)}
                  onMutationStateChange={onMutationStateChange}
                />
              ) : (
                <BlockCard
                  key={item.block.id}
                  block={item.block}
                  onEdit={() => setEditBlockId(item.block.id)}
                  onDelete={() => setDeleteBlockId(item.block.id)}
                />
              ),
            )}
          </div>
        </SortableContext>
      </DndContext>

      {displayItems.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("noExercises")}
        </p>
      )}

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => setPickerOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {t("addExercise")}
      </Button>

      <ExerciseLibraryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        dayId={dayId}
        dayLabel={label}
        existingExerciseCount={soloItems.length}
        existingExercises={soloItems.map((e) => ({
          exercise_id: e.exercise_id,
          id: e.id,
        }))}
        onMutationStateChange={onMutationStateChange}
        existingMaxSortOrder={existingMaxSortOrder}
        onCreateBlock={handleCreateBlock}
      />

      {editBlock && (
        <BlockEditor
          open={!!editBlock}
          onOpenChange={(open) => !open && setEditBlockId(null)}
          block={editBlock}
          dayId={dayId}
          onMutationStateChange={onMutationStateChange}
        />
      )}

      <Dialog
        open={!!deleteBlockTarget}
        onOpenChange={(open) => !open && setDeleteBlockId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeBlockTitle")}</DialogTitle>
            <DialogDescription>
              {t("removeBlockDescription", {
                name: deleteBlockTarget?.label ?? t("blockDefaultLabel"),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteBlockId(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteBlock}
              disabled={deleteBlock.isPending}
            >
              {deleteBlock.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("remove")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeExerciseTitle")}</DialogTitle>
            <DialogDescription>
              {t("removeExerciseDescription", {
                name: deleteTarget ? exerciseName(deleteTarget) : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteExercise}
              disabled={deleteExercise.isPending}
            >
              {deleteExercise.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("remove")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
