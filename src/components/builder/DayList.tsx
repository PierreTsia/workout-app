import { useState } from "react"
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
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Loader2, Plus, Trash2, GripVertical, Dumbbell } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  useWorkoutDays,
  type WorkoutDayWithExerciseCount,
} from "@/hooks/useWorkoutDays"
import { useProgramIntent } from "@/hooks/useProgramIntent"
import {
  useCreateDay,
  useDeleteDay,
  useReorderDays,
} from "@/hooks/useBuilderMutations"
import { dayIntentToHeatmap } from "@/lib/programScore/dayIntentToHeatmap"
import type { ProgramIntentDay } from "@/lib/programScore/types"
import { DayListSkeleton } from "./DayListSkeleton"
import {
  BodyMap,
  BODY_MAP_INTENSITY_COLORS,
} from "@/components/body-map/BodyMap"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DayListProps {
  programId: string
  onSelectDay: (dayId: string) => void
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function DayList({ programId, onSelectDay, onMutationStateChange }: DayListProps) {
  const { t } = useTranslation("builder")
  const { data: days, isLoading } = useWorkoutDays(programId)
  const { data: intent } = useProgramIntent(programId)
  const createDay = useCreateDay(programId)
  const deleteDay = useDeleteDay(programId)
  const reorderDays = useReorderDays(programId)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    label: string
  } | null>(null)
  const [pendingDays, setPendingDays] = useState<{
    programId: string
    days: WorkoutDayWithExerciseCount[]
  } | null>(null)

  const items =
    pendingDays?.programId === programId ? pendingDays.days : (days ?? [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((d) => d.id === active.id)
    const newIndex = items.findIndex((d) => d.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const nextDays = arrayMove(items, oldIndex, newIndex).map((d, sort_order) => ({
      ...d,
      sort_order,
    }))
    setPendingDays({ programId, days: nextDays })

    onMutationStateChange("saving")
    reorderDays.mutate(
      nextDays.map((d) => ({ id: d.id, sort_order: d.sort_order })),
      {
        onSettled: () => setPendingDays(null),
        onSuccess: () => onMutationStateChange("saved"),
        onError: () => onMutationStateChange("error"),
      },
    )
  }

  function handleNewDay() {
    onMutationStateChange("saving")
    createDay.mutate(
      {
        label: `Day ${(days?.length ?? 0) + 1}`,
        emoji: "🏋️",
        sortOrder: days?.length ?? 0,
      },
      {
        onSuccess: () => onMutationStateChange("saved"),
        onError: () => onMutationStateChange("error"),
      },
    )
  }

  function confirmDelete() {
    if (!deleteTarget) return
    onMutationStateChange("saving")
    deleteDay.mutate(deleteTarget.id, {
      onSuccess: () => {
        onMutationStateChange("saved")
        setDeleteTarget(null)
      },
      onError: () => {
        onMutationStateChange("error")
        setDeleteTarget(null)
      },
    })
  }

  if (isLoading) {
    return <DayListSkeleton />
  }

  const intentById = new Map((intent?.days ?? []).map((day) => [day.id, day]))

  return (
    <div className="flex flex-col gap-3 p-4">
      {items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Dumbbell className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {t("noDays")}
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((day) => (
            <DayCard
              key={day.id}
              dayId={day.id}
              label={day.label}
              emoji={day.emoji}
              intentDay={intentById.get(day.id)}
              onTap={() => onSelectDay(day.id)}
              onDelete={() =>
                setDeleteTarget({ id: day.id, label: day.label })
              }
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handleNewDay}
        disabled={createDay.isPending}
      >
        {createDay.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {t("newDay")}
      </Button>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteDayTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDayDescription", { label: deleteTarget?.label })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteDay.isPending}
            >
              {deleteDay.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("common:delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DayCard({
  dayId,
  label,
  emoji,
  intentDay,
  onTap,
  onDelete,
}: {
  dayId: string
  label: string
  emoji: string
  intentDay: ProgramIntentDay | undefined
  onTap: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dayId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const heatmap = intentDay ? dayIntentToHeatmap(intentDay) : null
  const showMap =
    heatmap != null && (heatmap.data.length > 0 || heatmap.chips.length > 0)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="cursor-pointer transition-colors active:bg-accent"
      onClick={onTap}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <button
          className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="text-2xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
        </div>
        {showMap && heatmap && (
          <BodyMap
            data={heatmap.data}
            size="sm"
            highlightedColors={BODY_MAP_INTENSITY_COLORS}
            className="shrink-0"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
