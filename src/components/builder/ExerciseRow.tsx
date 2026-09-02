import { useCallback, useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useTranslation } from "react-i18next"
import { GripVertical } from "lucide-react"
import type { WorkoutExercise, WorkoutExerciseWithExercise } from "@/types/database"
import { useUpdateExercise } from "@/hooks/useBuilderMutations"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { DEFAULT_DURATION_FALLBACK_SEC } from "@/lib/sessionSetRow"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { ExerciseOverflowMenu } from "./ExerciseOverflowMenu"
import { ExerciseDetailSheet } from "./ExerciseDetailSheet"

interface ExerciseRowProps {
  exercise: WorkoutExerciseWithExercise
  onDelete: () => void
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

interface RowForm {
  sets: string
  reps: string
  weight: string
  rest_seconds: string
  target_duration_seconds: string
}

function seedForm(
  exercise: WorkoutExercise,
  toDisplay: (kg: number) => number,
  defaultHoldSeconds: number,
): RowForm {
  const displayWeight = Math.round(toDisplay(Number(exercise.weight)) * 10) / 10
  return {
    sets: String(exercise.sets),
    reps: exercise.reps,
    weight: String(displayWeight),
    rest_seconds: String(exercise.rest_seconds),
    target_duration_seconds: String(
      exercise.target_duration_seconds ?? defaultHoldSeconds,
    ),
  }
}

const compactInputClass = "h-8 px-1 text-center font-mono text-sm"

function stopRowTap(event: SyntheticEvent) {
  event.stopPropagation()
}

type FieldPatch = {
  sets?: number
  reps?: string
  weight?: string
  rest_seconds?: number
  target_duration_seconds?: number | null
}

function fieldPatch(
  field: keyof RowForm,
  updated: RowForm,
  toKg: (value: number) => number,
): FieldPatch {
  switch (field) {
    case "sets": {
      const sets = parseInt(updated.sets, 10)
      return isNaN(sets) ? {} : { sets }
    }
    case "reps":
      return { reps: updated.reps || undefined }
    case "weight": {
      if (!updated.weight) return {}
      const weightKg = toKg(Number(updated.weight) || 0)
      return { weight: String(Math.round(weightKg * 10) / 10) }
    }
    case "rest_seconds": {
      const restSeconds = parseInt(updated.rest_seconds, 10)
      return isNaN(restSeconds) ? {} : { rest_seconds: restSeconds }
    }
    case "target_duration_seconds": {
      const targetSec = parseInt(updated.target_duration_seconds, 10)
      return { target_duration_seconds: isNaN(targetSec) ? null : targetSec }
    }
  }
}

function formPatch(
  updated: RowForm,
  fields: Iterable<keyof RowForm>,
  toKg: (value: number) => number,
): FieldPatch {
  return [...fields].reduce<FieldPatch>(
    (patch, field) => ({ ...patch, ...fieldPatch(field, updated, toKg) }),
    {},
  )
}

export function ExerciseRow({
  exercise,
  onDelete,
  onMutationStateChange,
}: ExerciseRowProps) {
  const { t } = useTranslation("builder")
  const { unit, toDisplay, toKg } = useWeightUnit()
  const { exerciseName } = useCatalogLabels()
  const { data: libExercise } = useExerciseFromLibrary(exercise.exercise_id)
  const catalog = libExercise ?? exercise.exercise
  const updateExercise = useUpdateExercise()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const isDuration = catalog?.measurement_type === "duration"
  const defaultHoldSeconds =
    catalog?.default_duration_seconds ?? DEFAULT_DURATION_FALLBACK_SEC
  const [form, setForm] = useState<RowForm>(() =>
    seedForm(exercise, toDisplay, defaultHoldSeconds),
  )
  const [trackedUnit, setTrackedUnit] = useState(unit)
  if (unit !== trackedUnit) {
    setTrackedUnit(unit)
    setForm((prev) => ({
      ...prev,
      weight: String(
        Math.round(toDisplay(Number(exercise.weight)) * 10) / 10,
      ),
    }))
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingRef = useRef<{
    form: RowForm
    fields: ReadonlySet<keyof RowForm>
  } | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const applyPatch = useCallback(
    (updated: RowForm, fields: Iterable<keyof RowForm>) => {
      const patch = formPatch(updated, fields, toKg)
      if (Object.keys(patch).length === 0) return
      onMutationStateChange("saving")
      updateExercise.mutate(
        {
          id: exercise.id,
          dayId: exercise.workout_day_id,
          ...patch,
        },
        {
          onSuccess: () => onMutationStateChange("saved"),
          onError: () => onMutationStateChange("error"),
        },
      )
    },
    [exercise.id, exercise.workout_day_id, updateExercise, onMutationStateChange, toKg],
  )
  const applyPatchRef = useRef(applyPatch)
  useEffect(() => {
    applyPatchRef.current = applyPatch
  })

  const flush = useCallback((updated: RowForm, field: keyof RowForm) => {
    const fields = new Set(pendingRef.current?.fields)
    fields.add(field)
    pendingRef.current = { form: updated, fields }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pendingRef.current = null
      applyPatchRef.current(updated, fields)
    }, 500)
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      const pending = pendingRef.current
      if (!pending) return
      pendingRef.current = null
      applyPatchRef.current(pending.form, pending.fields)
    }
  }, [])

  function handleChange(field: keyof RowForm, value: string) {
    const next = { ...form, [field]: value }
    setForm(next)
    flush(next, field)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-2 rounded-lg border bg-card p-3 md:grid md:grid-cols-[auto_1fr_40px_40px_50px_50px_auto] md:items-center md:gap-2"
    >
      <div className="flex items-center gap-2 md:contents">
        <button
          className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ExerciseThumbnail
            imageUrl={catalog?.image_url}
            emoji={exercise.emoji_snapshot}
            className="h-9 w-9 rounded-md"
          />
          <span className="truncate text-sm font-medium">{exerciseName(exercise)}</span>
        </div>

        <div
          className="ml-auto flex shrink-0 items-center md:col-start-7 md:row-start-1 md:ml-0"
          onClick={stopRowTap}
          onPointerDown={stopRowTap}
        >
          <ExerciseOverflowMenu
            exerciseId={exercise.exercise_id}
            onEditDetails={() => setDetailsOpen(true)}
            onRemove={onDelete}
          />
        </div>
      </div>

      {detailsOpen && (
        <ExerciseDetailSheet
          exercise={exercise}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onMutationStateChange={onMutationStateChange}
        />
      )}

      <div
        className="grid grid-cols-4 gap-1 md:contents"
        onClick={stopRowTap}
        onPointerDown={stopRowTap}
      >
        <CompactField label={t("sets")} className="md:col-start-3 md:row-start-1">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={form.sets}
            onChange={(e) => handleChange("sets", e.target.value)}
            className={compactInputClass}
          />
        </CompactField>
        {isDuration ? (
          <CompactField label={t("holdColumn")} className="md:col-start-4 md:row-start-1">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.target_duration_seconds}
              onChange={(e) => handleChange("target_duration_seconds", e.target.value)}
              className={compactInputClass}
            />
          </CompactField>
        ) : (
          <CompactField label={t("reps")} className="md:col-start-4 md:row-start-1">
            <Input
              value={form.reps}
              onChange={(e) => handleChange("reps", e.target.value)}
              placeholder={t("placeholderReps")}
              className={compactInputClass}
            />
          </CompactField>
        )}
        <CompactField label={unit} className="md:col-start-5 md:row-start-1">
          <Input
            value={form.weight}
            onChange={(e) => handleChange("weight", e.target.value)}
            placeholder={t("placeholderWeight")}
            className={compactInputClass}
          />
        </CompactField>
        <CompactField label={t("restColumn")} className="md:col-start-6 md:row-start-1">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={15}
            value={form.rest_seconds}
            onChange={(e) => handleChange("rest_seconds", e.target.value)}
            className={compactInputClass}
          />
        </CompactField>
      </div>
    </div>
  )
}

function CompactField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <Label className={cn("flex min-w-0 flex-col gap-0.5 font-normal", className)}>
      <span className="text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </Label>
  )
}
