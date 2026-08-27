import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import type {
  WorkoutExercise,
  WorkoutExerciseWithExercise,
} from "@/types/database"
import { useUpdateExercise } from "@/hooks/useBuilderMutations"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import type { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ExerciseInstructionsPanel } from "@/components/exercise/ExerciseInstructionsPanel"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { FeedbackTrigger } from "@/components/feedback/FeedbackTrigger"
import { ProfileHint } from "@/components/profile/ProfileHint"

type LibraryExercise = ReturnType<typeof useExerciseFromLibrary>["data"]

interface ExerciseDetailFormProps {
  exercise: WorkoutExerciseWithExercise
  libExercise: LibraryExercise
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

interface FormState {
  rep_range_min: string
  rep_range_max: string
  set_range_min: string
  set_range_max: string
  weight_increment: string
  max_weight_reached: boolean
  duration_range_min_seconds: string
  duration_range_max_seconds: string
  duration_increment_seconds: string
}

function seedForm(exercise: WorkoutExercise): FormState {
  return {
    rep_range_min: exercise.rep_range_min != null ? String(exercise.rep_range_min) : "",
    rep_range_max: exercise.rep_range_max != null ? String(exercise.rep_range_max) : "",
    set_range_min: exercise.set_range_min != null ? String(exercise.set_range_min) : "",
    set_range_max: exercise.set_range_max != null ? String(exercise.set_range_max) : "",
    weight_increment: exercise.weight_increment != null ? String(exercise.weight_increment) : "",
    max_weight_reached: exercise.max_weight_reached ?? false,
    duration_range_min_seconds: exercise.duration_range_min_seconds != null ? String(exercise.duration_range_min_seconds) : "",
    duration_range_max_seconds: exercise.duration_range_max_seconds != null ? String(exercise.duration_range_max_seconds) : "",
    duration_increment_seconds: exercise.duration_increment_seconds != null ? String(exercise.duration_increment_seconds) : "",
  }
}

function leftoverPatch(
  updated: FormState,
  isDuration: boolean,
): {
  rep_range_min?: number
  rep_range_max?: number
  set_range_min?: number
  set_range_max?: number
  weight_increment?: number | null
  max_weight_reached: boolean
  duration_range_min_seconds?: number | null
  duration_range_max_seconds?: number | null
  duration_increment_seconds?: number | null
} {
  const repMin = parseInt(updated.rep_range_min, 10)
  const repMax = parseInt(updated.rep_range_max, 10)
  const setMin = parseInt(updated.set_range_min, 10)
  const setMax = parseInt(updated.set_range_max, 10)
  const wInc = parseFloat(updated.weight_increment)
  const durMin = parseInt(updated.duration_range_min_seconds, 10)
  const durMax = parseInt(updated.duration_range_max_seconds, 10)
  const durInc = parseInt(updated.duration_increment_seconds, 10)

  return {
    rep_range_min: isNaN(repMin) ? undefined : repMin,
    rep_range_max: isNaN(repMax) ? undefined : repMax,
    set_range_min: isNaN(setMin) ? undefined : setMin,
    set_range_max: isNaN(setMax) ? undefined : setMax,
    weight_increment:
      isNaN(wInc) || updated.weight_increment === "" || wInc <= 0 ? null : wInc,
    max_weight_reached: updated.max_weight_reached,
    duration_range_min_seconds: isDuration
      ? isNaN(durMin)
        ? null
        : durMin
      : undefined,
    duration_range_max_seconds: isDuration
      ? isNaN(durMax)
        ? null
        : durMax
      : undefined,
    duration_increment_seconds: isDuration
      ? isNaN(durInc)
        ? null
        : durInc
      : undefined,
  }
}

/**
 * Leftover engine fields (ranges, increment, max weight). The four inline
 * slot fields live on ExerciseRow — this form must not re-edit them.
 */
export function ExerciseDetailForm({
  exercise,
  libExercise,
  onMutationStateChange,
}: ExerciseDetailFormProps) {
  const { t } = useTranslation("builder")
  const { exerciseName, muscleLabel } = useCatalogLabels()
  const updateExercise = useUpdateExercise()
  const isDuration = libExercise?.measurement_type === "duration"

  const [form, setForm] = useState<FormState>(() => seedForm(exercise))

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingRef = useRef<FormState | null>(null)

  const applyPatch = useCallback(
    (updated: FormState) => {
      onMutationStateChange("saving")
      updateExercise.mutate(
        {
          id: exercise.id,
          dayId: exercise.workout_day_id,
          ...leftoverPatch(updated, isDuration),
        },
        {
          onSuccess: () => onMutationStateChange("saved"),
          onError: () => onMutationStateChange("error"),
        },
      )
    },
    [
      exercise.id,
      exercise.workout_day_id,
      updateExercise,
      onMutationStateChange,
      isDuration,
    ],
  )
  const applyPatchRef = useRef(applyPatch)
  applyPatchRef.current = applyPatch

  const flush = useCallback((updated: FormState) => {
    pendingRef.current = updated
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      pendingRef.current = null
      applyPatchRef.current(updated)
    }, 500)
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      const pending = pendingRef.current
      if (!pending) return
      pendingRef.current = null
      applyPatchRef.current(pending)
    }
  }, [])

  function handleChange(field: keyof FormState, value: string) {
    const next = { ...form, [field]: value }
    setForm(next)
    flush(next)
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ExerciseThumbnail imageUrl={libExercise?.image_url} emoji={exercise.emoji_snapshot} className="h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">
              {exerciseName(exercise)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {muscleLabel(libExercise?.muscle_group ?? exercise.muscle_snapshot)}
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

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/50">
          {t("progressionSettings")}
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=open]>&]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-2 gap-4">
            {isDuration ? (
              <>
                <FieldGroup label={t("durationRangeMin")}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={form.duration_range_min_seconds}
                    onChange={(e) => handleChange("duration_range_min_seconds", e.target.value)}
                    placeholder="20"
                  />
                </FieldGroup>
                <FieldGroup label={t("durationRangeMax")}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={form.duration_range_max_seconds}
                    onChange={(e) => handleChange("duration_range_max_seconds", e.target.value)}
                    placeholder="45"
                  />
                </FieldGroup>
                <FieldGroup label={t("durationIncrement")}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={form.duration_increment_seconds}
                    onChange={(e) => handleChange("duration_increment_seconds", e.target.value)}
                    placeholder="5"
                  />
                </FieldGroup>
              </>
            ) : (
              <>
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
              </>
            )}
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
                min={0.25}
                step={0.5}
                value={form.weight_increment}
                onChange={(e) => handleChange("weight_increment", e.target.value)}
                placeholder={t("weightIncrementPlaceholder")}
              />
            </FieldGroup>
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                {t("maxWeightReached")}
                <ProfileHint label={t("maxWeightReachedHintAria")}>
                  {t("maxWeightReachedHint")}
                </ProfileHint>
              </span>
              <Switch
                checked={form.max_weight_reached}
                aria-label={t("maxWeightReached")}
                onCheckedChange={(checked) => {
                  const next = { ...form, max_weight_reached: checked }
                  setForm(next)
                  flush(next)
                }}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
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
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
