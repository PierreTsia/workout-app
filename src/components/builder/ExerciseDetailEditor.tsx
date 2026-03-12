import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useUpdateExercise } from "@/hooks/useBuilderMutations"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { Input } from "@/components/ui/input"

interface ExerciseDetailEditorProps {
  dayId: string
  exerciseId: string
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

interface FormState {
  sets: string
  reps: string
  weight: string
  rest_seconds: string
}

export function ExerciseDetailEditor({
  dayId,
  exerciseId,
  onMutationStateChange,
}: ExerciseDetailEditorProps) {
  const { t } = useTranslation("builder")
  const { unit, toDisplay, toKg } = useWeightUnit()
  const { data: exercises } = useWorkoutExercises(dayId)
  const updateExercise = useUpdateExercise()
  const exercise = exercises?.find((e) => e.id === exerciseId)

  const [form, setForm] = useState<FormState>({
    sets: "",
    reps: "",
    weight: "",
    rest_seconds: "",
  })
  const [trackedExerciseId, setTrackedExerciseId] = useState(exerciseId)
  const [trackedUnit, setTrackedUnit] = useState(unit)

  if (exerciseId !== trackedExerciseId || unit !== trackedUnit) {
    setTrackedExerciseId(exerciseId)
    setTrackedUnit(unit)
    if (exercise) {
      const displayWeight = Math.round(toDisplay(Number(exercise.weight)) * 10) / 10
      setForm({
        sets: String(exercise.sets),
        reps: exercise.reps,
        weight: String(displayWeight),
        rest_seconds: String(exercise.rest_seconds),
      })
    }
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const flush = useCallback(
    (updated: FormState) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const sets = parseInt(updated.sets, 10)
        const restSeconds = parseInt(updated.rest_seconds, 10)
        const weightKg = toKg(Number(updated.weight) || 0)
        onMutationStateChange("saving")
        updateExercise.mutate(
          {
            id: exerciseId,
            dayId,
            sets: isNaN(sets) ? undefined : sets,
            reps: updated.reps || undefined,
            weight: updated.weight ? String(Math.round(weightKg * 10) / 10) : undefined,
            rest_seconds: isNaN(restSeconds) ? undefined : restSeconds,
          },
          {
            onSuccess: () => onMutationStateChange("saved"),
            onError: () => onMutationStateChange("error"),
          },
        )
      }, 500)
    },
    [exerciseId, dayId, updateExercise, onMutationStateChange, toKg],
  )

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  function handleChange(field: keyof FormState, value: string) {
    const next = { ...form, [field]: value }
    setForm(next)
    flush(next)
  }

  if (!exercise) return null

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{exercise.emoji_snapshot}</span>
        <div>
          <h2 className="text-lg font-bold">{exercise.name_snapshot}</h2>
          <p className="text-sm text-muted-foreground">
            {exercise.muscle_snapshot}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label={t("sets")}>
          <Input
            type="number"
            inputMode="numeric"
            value={form.sets}
            onChange={(e) => handleChange("sets", e.target.value)}
            min={1}
          />
        </FieldGroup>

        <FieldGroup label={t("reps")}>
          <Input
            value={form.reps}
            onChange={(e) => handleChange("reps", e.target.value)}
            placeholder={t("placeholderReps")}
          />
        </FieldGroup>

        <FieldGroup label={t("weightLabel", { unit })}>
          <Input
            value={form.weight}
            onChange={(e) => handleChange("weight", e.target.value)}
            placeholder={t("placeholderWeight")}
          />
        </FieldGroup>

        <FieldGroup label={t("restSeconds")}>
          <Input
            type="number"
            inputMode="numeric"
            value={form.rest_seconds}
            onChange={(e) => handleChange("rest_seconds", e.target.value)}
            min={0}
            step={15}
          />
        </FieldGroup>
      </div>
    </div>
  )
}

function FieldGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
