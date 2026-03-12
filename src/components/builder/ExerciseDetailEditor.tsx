import { useCallback, useEffect, useRef, useState } from "react"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useUpdateExercise } from "@/hooks/useBuilderMutations"
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
  const { data: exercises } = useWorkoutExercises(dayId)
  const updateExercise = useUpdateExercise()
  const exercise = exercises?.find((e) => e.id === exerciseId)

  const [form, setForm] = useState<FormState>({
    sets: "",
    reps: "",
    weight: "",
    rest_seconds: "",
  })

  useEffect(() => {
    if (exercise) {
      setForm({
        sets: String(exercise.sets),
        reps: exercise.reps,
        weight: exercise.weight,
        rest_seconds: String(exercise.rest_seconds),
      })
    }
  }, [exercise])

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const flush = useCallback(
    (updated: FormState) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const sets = parseInt(updated.sets, 10)
        const restSeconds = parseInt(updated.rest_seconds, 10)
        onMutationStateChange("saving")
        updateExercise.mutate(
          {
            id: exerciseId,
            dayId,
            sets: isNaN(sets) ? undefined : sets,
            reps: updated.reps || undefined,
            weight: updated.weight || undefined,
            rest_seconds: isNaN(restSeconds) ? undefined : restSeconds,
          },
          {
            onSuccess: () => onMutationStateChange("saved"),
            onError: () => onMutationStateChange("error"),
          },
        )
      }, 500)
    },
    [exerciseId, dayId, updateExercise, onMutationStateChange],
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
        <FieldGroup label="Sets">
          <Input
            type="number"
            inputMode="numeric"
            value={form.sets}
            onChange={(e) => handleChange("sets", e.target.value)}
            min={1}
          />
        </FieldGroup>

        <FieldGroup label="Reps">
          <Input
            value={form.reps}
            onChange={(e) => handleChange("reps", e.target.value)}
            placeholder="e.g. 8-12"
          />
        </FieldGroup>

        <FieldGroup label="Weight (kg)">
          <Input
            value={form.weight}
            onChange={(e) => handleChange("weight", e.target.value)}
            placeholder="e.g. 10"
          />
        </FieldGroup>

        <FieldGroup label="Rest (seconds)">
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
