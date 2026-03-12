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
  arrayMove,
} from "@dnd-kit/sortable"
import { Loader2, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import {
  useUpdateDay,
  useDeleteExercise,
  useReorderExercises,
} from "@/hooks/useBuilderMutations"
import type { WorkoutExercise } from "@/types/database"
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

interface DayEditorProps {
  dayId: string
  onSelectExercise: (exerciseId: string) => void
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function DayEditor({
  dayId,
  onSelectExercise,
  onMutationStateChange,
}: DayEditorProps) {
  const { t } = useTranslation("builder")
  const { data: days } = useWorkoutDays()
  const { data: exercises, isLoading } = useWorkoutExercises(dayId)
  const updateDay = useUpdateDay()
  const deleteExercise = useDeleteExercise()
  const reorderExercises = useReorderExercises()

  const day = days?.find((d) => d.id === dayId)

  const [label, setLabel] = useState(day?.label ?? "")
  const [trackedDayId, setTrackedDayId] = useState(dayId)
  const [pickerOpen, setPickerOpen] = useState(false)
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !exercises) return

    const oldIndex = exercises.findIndex((e) => e.id === active.id)
    const newIndex = exercises.findIndex((e) => e.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(exercises, oldIndex, newIndex).map(
      (ex, idx) => ({ id: ex.id, sort_order: idx }),
    )

    onMutationStateChange("saving")
    reorderExercises.mutate(
      { dayId, exercises: reordered },
      {
        onSuccess: () => onMutationStateChange("saved"),
        onError: () => onMutationStateChange("error"),
      },
    )
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

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const items = exercises ?? []

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
          items={items.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {items.map((ex) => (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                onTap={() => onSelectExercise(ex.id)}
                onDelete={() => setDeleteTarget(ex)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
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
        existingExerciseCount={items.length}
        onMutationStateChange={onMutationStateChange}
      />

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
