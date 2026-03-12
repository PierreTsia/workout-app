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
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import {
  useCreateDay,
  useDeleteDay,
  useReorderDays,
} from "@/hooks/useBuilderMutations"
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
  onSelectDay: (dayId: string) => void
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

export function DayList({ onSelectDay, onMutationStateChange }: DayListProps) {
  const { data: days, isLoading } = useWorkoutDays()
  const createDay = useCreateDay()
  const deleteDay = useDeleteDay()
  const reorderDays = useReorderDays()
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    label: string
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !days) return

    const oldIndex = days.findIndex((d) => d.id === active.id)
    const newIndex = days.findIndex((d) => d.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(days, oldIndex, newIndex).map((d, idx) => ({
      id: d.id,
      sort_order: idx,
    }))

    onMutationStateChange("saving")
    reorderDays.mutate(reordered, {
      onSuccess: () => onMutationStateChange("saved"),
      onError: () => onMutationStateChange("error"),
    })
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
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const items = days ?? []

  return (
    <div className="flex flex-col gap-3 p-4">
      {items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Dumbbell className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No workout days yet. Create your first one!
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
        New Day
      </Button>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workout day?</DialogTitle>
            <DialogDescription>
              "{deleteTarget?.label}" and all its exercises will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteDay.isPending}
            >
              {deleteDay.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
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
  onTap,
  onDelete,
}: {
  dayId: string
  label: string
  emoji: string
  onTap: () => void
  onDelete: () => void
}) {
  const { data: exercises } = useWorkoutExercises(dayId)
  const count = exercises?.length ?? 0

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
        <div className="flex-1">
          <p className="font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">
            {count} exercise{count !== 1 ? "s" : ""}
          </p>
        </div>
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
