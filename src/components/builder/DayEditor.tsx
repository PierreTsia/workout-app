import { useCallback, useEffect, useRef, useState } from "react"
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
import { Layers, Loader2, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useDayItems } from "@/hooks/useDayItems"
import {
  useCreateBlock,
  useReorderBlocks,
  useDeleteBlock,
} from "@/hooks/useBlockMutations"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import {
  useUpdateDay,
  useDeleteExercise,
  useReorderExercises,
} from "@/hooks/useBuilderMutations"
import { dayItemId, reorderDayItems } from "@/lib/dayItems"
import type { Exercise, WorkoutExercise } from "@/types/database"
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
import { ExerciseRow } from "./ExerciseRow"
import { ExerciseLibraryPicker } from "./ExerciseLibraryPicker"
import { BlockCard } from "./BlockCard"
import { BlockEditor } from "./BlockEditor"

interface DayEditorProps {
  programId: string
  dayId: string
  onSelectExercise: (exerciseId: string) => void
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function DayEditor({
  programId,
  dayId,
  onSelectExercise,
  onMutationStateChange,
}: DayEditorProps) {
  const { t } = useTranslation("builder")
  const { data: days } = useWorkoutDays(programId)
  const { data: exercises, isLoading } = useWorkoutExercises(dayId)
  const { items: dayItems } = useDayItems(dayId)
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
  const [blockPickerOpen, setBlockPickerOpen] = useState(false)
  const [editBlockId, setEditBlockId] = useState<string | null>(null)
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkoutExercise | null>(null)

  if (dayId !== trackedDayId) {
    setTrackedDayId(dayId)
    setLabel(day?.label ?? "")
  }

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

    const { solos, blocks } = reorderDayItems(
      dayItems,
      String(active.id),
      String(over.id),
    )
    if (solos.length === 0 && blocks.length === 0) return

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

  async function handleCreateBlock(selected: Exercise[]) {
    const existingMaxSortOrder = dayItems.reduce(
      (max, item) => Math.max(max, item.sort_order),
      -1,
    )
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

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const soloItems = exercises ?? []
  const blocks = dayItems.flatMap((i) => (i.kind === "block" ? [i.block] : []))
  const editBlock = blocks.find((b) => b.id === editBlockId) ?? null
  const deleteBlockTarget = blocks.find((b) => b.id === deleteBlockId) ?? null

  return (
    <div className="flex flex-col gap-4 p-4">
      <Input
        value={label}
        onChange={(e) => handleLabelChange(e.target.value)}
        placeholder={t("dayName")}
        className="text-lg font-semibold"
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={dayItems.map(dayItemId)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {dayItems.map((item) =>
              item.kind === "solo" ? (
                <ExerciseRow
                  key={item.exercise.id}
                  exercise={item.exercise}
                  onTap={() => onSelectExercise(item.exercise.id)}
                  onDelete={() => setDeleteTarget(item.exercise)}
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

      {dayItems.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("noExercises")}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("addExercise")}
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setBlockPickerOpen(true)}
        >
          <Layers className="h-4 w-4" />
          {t("createBlock")}
        </Button>
      </div>

      <ExerciseLibraryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        dayId={dayId}
        existingExerciseCount={soloItems.length}
        existingExercises={soloItems.map((e) => ({
          exercise_id: e.exercise_id,
          id: e.id,
        }))}
        onMutationStateChange={onMutationStateChange}
      />

      <ExerciseLibraryPicker
        open={blockPickerOpen}
        onOpenChange={setBlockPickerOpen}
        dayId={dayId}
        existingExerciseCount={0}
        onMutationStateChange={onMutationStateChange}
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
                name: deleteTarget?.name_snapshot,
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
