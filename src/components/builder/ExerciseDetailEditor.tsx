import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import { useWorkoutExercises } from "@/hooks/useWorkoutExercises"
import { useUpdateExercise } from "@/hooks/useBuilderMutations"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ExerciseInstructionsPanel } from "@/components/exercise/ExerciseInstructionsPanel"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger"
import { DEFAULT_DURATION_FALLBACK_SEC } from "@/lib/sessionSetRow"

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
  /** Template override seconds for duration exercises */
  target_duration_seconds: string
  rep_range_min: string
  rep_range_max: string
  set_range_min: string
  set_range_max: string
  weight_increment: string
  max_weight_reached: boolean
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
  const { data: libExercise } = useExerciseFromLibrary(exercise?.exercise_id ?? "")

  const [form, setForm] = useState<FormState>({
    sets: "",
    reps: "",
    weight: "",
    rest_seconds: "",
    target_duration_seconds: "",
    rep_range_min: "",
    rep_range_max: "",
    set_range_min: "",
    set_range_max: "",
    weight_increment: "",
    max_weight_reached: false,
  })
  const [trackedExerciseId, setTrackedExerciseId] = useState(exerciseId)
  const [trackedUnit, setTrackedUnit] = useState(unit)

  if (exerciseId !== trackedExerciseId || unit !== trackedUnit) {
    setTrackedExerciseId(exerciseId)
    setTrackedUnit(unit)
    if (exercise) {
      const displayWeight = Math.round(toDisplay(Number(exercise.weight)) * 10) / 10
      const lib = libExercise
      const targetSec =
        exercise.target_duration_seconds ??
        lib?.default_duration_seconds ??
        DEFAULT_DURATION_FALLBACK_SEC
      setForm({
        sets: String(exercise.sets),
        reps: exercise.reps,
        weight: String(displayWeight),
        rest_seconds: String(exercise.rest_seconds),
        target_duration_seconds: String(targetSec),
        rep_range_min: String(exercise.rep_range_min),
        rep_range_max: String(exercise.rep_range_max),
        set_range_min: String(exercise.set_range_min),
        set_range_max: String(exercise.set_range_max),
        weight_increment: exercise.weight_increment != null ? String(exercise.weight_increment) : "",
        max_weight_reached: exercise.max_weight_reached ?? false,
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
        const isDuration = libExercise?.measurement_type === "duration"
        const targetSec = parseInt(updated.target_duration_seconds, 10)
        const repMin = parseInt(updated.rep_range_min, 10)
        const repMax = parseInt(updated.rep_range_max, 10)
        const setMin = parseInt(updated.set_range_min, 10)
        const setMax = parseInt(updated.set_range_max, 10)
        const wInc = parseFloat(updated.weight_increment)

        updateExercise.mutate(
          {
            id: exerciseId,
            dayId,
            sets: isNaN(sets) ? undefined : sets,
            reps: isDuration ? undefined : updated.reps || undefined,
            weight: updated.weight ? String(Math.round(weightKg * 10) / 10) : undefined,
            rest_seconds: isNaN(restSeconds) ? undefined : restSeconds,
            target_duration_seconds: isDuration
              ? isNaN(targetSec)
                ? null
                : targetSec
              : undefined,
            rep_range_min: isNaN(repMin) ? undefined : repMin,
            rep_range_max: isNaN(repMax) ? undefined : repMax,
            set_range_min: isNaN(setMin) ? undefined : setMin,
            set_range_max: isNaN(setMax) ? undefined : setMax,
            weight_increment: isNaN(wInc) || updated.weight_increment === "" ? null : wInc,
            max_weight_reached: updated.max_weight_reached,
          },
          {
            onSuccess: () => onMutationStateChange("saved"),
            onError: () => onMutationStateChange("error"),
          },
        )
      }, 500)
    },
    [exerciseId, dayId, updateExercise, onMutationStateChange, toKg, libExercise?.measurement_type],
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ExerciseThumbnail imageUrl={libExercise?.image_url} emoji={exercise.emoji_snapshot} className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{exercise.name_snapshot}</h2>
            <p className="text-sm text-muted-foreground">
              {exercise.muscle_snapshot}
            </p>
          </div>
        </div>
        <FeedbackTrigger
          exerciseId={exercise.exercise_id}
          sourceScreen="builder"
          className="shrink-0"
        />
      </div>

      <ExerciseInstructionsPanel exerciseId={exercise.exercise_id} />

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

        {libExercise?.measurement_type === "duration" ? (
          <FieldGroup label={t("targetDurationSeconds")}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.target_duration_seconds}
              onChange={(e) => handleChange("target_duration_seconds", e.target.value)}
              placeholder={String(DEFAULT_DURATION_FALLBACK_SEC)}
            />
          </FieldGroup>
        ) : (
          <FieldGroup label={t("reps")}>
            <Input
              value={form.reps}
              onChange={(e) => handleChange("reps", e.target.value)}
              placeholder={t("placeholderReps")}
            />
          </FieldGroup>
        )}

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

      {libExercise?.measurement_type !== "duration" && (
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/50">
            {t("progressionSettings")}
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=open]>&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label={t("repRangeMin")}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.rep_range_min}
                  onChange={(e) => handleChange("rep_range_min", e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label={t("repRangeMax")}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.rep_range_max}
                  onChange={(e) => handleChange("rep_range_max", e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label={t("setRangeMin")}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.set_range_min}
                  onChange={(e) => handleChange("set_range_min", e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label={t("setRangeMax")}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.set_range_max}
                  onChange={(e) => handleChange("set_range_max", e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label={t("weightIncrement")}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={form.weight_increment}
                  onChange={(e) => handleChange("weight_increment", e.target.value)}
                  placeholder={t("weightIncrementPlaceholder")}
                />
              </FieldGroup>
              <FieldGroup label={t("maxWeightReached")}>
                <Switch
                  checked={form.max_weight_reached}
                  onCheckedChange={(checked) => {
                    const next = { ...form, max_weight_reached: checked }
                    setForm(next)
                    flush(next)
                  }}
                />
              </FieldGroup>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
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
