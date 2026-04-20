import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, ArrowLeft, Plus, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CoachRationale } from "@/components/create-program/CoachRationale"
import { PreviewExerciseCard } from "./PreviewExerciseCard"
import { ExerciseSwapPicker } from "./ExerciseSwapPicker"
import { ExerciseAddPicker } from "./ExerciseAddPicker"
import { ExerciseDetailSheet } from "./ExerciseDetailSheet"
import { useExerciseById } from "@/hooks/useExerciseById"
import type { ExerciseListItem } from "@/types/database"
import type { GeneratedExercise, GeneratedWorkout } from "@/types/generator"
import {
  COMPOUND_REPS,
  COMPOUND_REST_SECONDS,
  ISOLATION_REPS,
  ISOLATION_REST_SECONDS,
} from "@/lib/generatorConfig"
import { buildBodyMapData } from "@/lib/muscleMapping"
import { SessionHeatmap } from "@/components/body-map/SessionHeatmap"

interface PreviewStepProps {
  workout: GeneratedWorkout
  exercisePool: ExerciseListItem[]
  onStart: (workout: GeneratedWorkout) => void
  onSave: (workout: GeneratedWorkout) => void
  onShuffle: () => void
  onBack: () => void
  isBusy: boolean
}

const SHUFFLE_COOLDOWN_MS = 1000

export function PreviewStep({
  workout,
  exercisePool,
  onStart,
  onSave,
  onShuffle,
  onBack,
  isBusy,
}: PreviewStepProps) {
  const { t } = useTranslation("generator")
  const [exercises, setExercises] = useState<GeneratedExercise[]>(
    workout.exercises,
  )
  const [name, setName] = useState(workout.name)
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)
  // Track inspected exercise by id, not index — list can mutate (remove/shuffle)
  // between click and render, and an out-of-bounds index would open a sheet
  // with no dismissable content.
  const [inspectedExerciseId, setInspectedExerciseId] = useState<string | null>(
    null,
  )
  const lastShuffleRef = useRef(0)

  const handleRemove = useCallback((index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSwap = useCallback((index: number) => {
    setSwappingIndex(index)
  }, [])

  const handleSwapSelect = useCallback(
    (exercise: ExerciseListItem) => {
      if (swappingIndex === null) return
      setExercises((prev) =>
        prev.map((ge, i) => {
          if (i !== swappingIndex) return ge
          const compound = (exercise.secondary_muscles?.length ?? 0) > 0
          return {
            exercise,
            sets: ge.sets,
            reps: compound ? COMPOUND_REPS : ISOLATION_REPS,
            restSeconds: compound
              ? COMPOUND_REST_SECONDS
              : ISOLATION_REST_SECONDS,
            isCompound: compound,
          }
        }),
      )
      setSwappingIndex(null)
    },
    [swappingIndex],
  )

  const handleUpdateSets = useCallback((index: number, sets: number) => {
    setExercises((prev) =>
      prev.map((ge, i) => (i === index ? { ...ge, sets } : ge)),
    )
  }, [])

  const handleUpdateReps = useCallback((index: number, reps: string) => {
    setExercises((prev) =>
      prev.map((ge, i) => (i === index ? { ...ge, reps } : ge)),
    )
  }, [])

  const handleShuffle = useCallback(() => {
    const now = Date.now()
    if (now - lastShuffleRef.current < SHUFFLE_COOLDOWN_MS) return
    lastShuffleRef.current = now
    onShuffle()
  }, [onShuffle])

  const handleAddExercise = useCallback(
    (exercise: ExerciseListItem) => {
      const compound = (exercise.secondary_muscles?.length ?? 0) > 0
      setExercises((prev) => {
        const defaultSets = prev[0]?.sets ?? 3
        return [
          ...prev,
          {
            exercise,
            sets: defaultSets,
            reps: compound ? COMPOUND_REPS : ISOLATION_REPS,
            restSeconds: compound
              ? COMPOUND_REST_SECONDS
              : ISOLATION_REST_SECONDS,
            isCompound: compound,
          },
        ]
      })
      setAddingExercise(false)
    },
    [],
  )

  const currentWorkout = useMemo(
    (): GeneratedWorkout => ({
      exercises,
      name,
      hasFallback: workout.hasFallback,
      ...(workout.rationale ? { rationale: workout.rationale } : {}),
    }),
    [exercises, name, workout.hasFallback, workout.rationale],
  )

  const handleStart = useCallback(() => {
    onStart(currentWorkout)
  }, [currentWorkout, onStart])

  const handleSave = useCallback(() => {
    onSave(currentWorkout)
  }, [currentWorkout, onSave])

  const heatmapData = useMemo(
    () =>
      buildBodyMapData(
        exercises.map((ge) => ({
          name: ge.exercise.name,
          muscleGroup: ge.exercise.muscle_group,
          secondaryMuscles: ge.exercise.secondary_muscles,
          sets: ge.sets,
        })),
      ),
    [exercises],
  )

  const currentExerciseIds = exercises.map((ge) => ge.exercise.id)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 text-base font-semibold"
        />
      </div>

      {workout.hasFallback && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          {t("fallbackNotice")}
        </div>
      )}

      {workout.rationale && (
        <CoachRationale rationale={workout.rationale} titleNs="generator" />
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1"
          size="lg"
          onClick={handleStart}
          disabled={exercises.length === 0 || isBusy}
        >
          {t("startWorkout")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleSave}
          disabled={exercises.length === 0 || isBusy}
          className="gap-1.5"
        >
          <Bookmark className="h-4 w-4" />
          {t("saveForLater")}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {exercises.length} {t("exercises")}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShuffle}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("shuffle")}
        </Button>
      </div>

      <SessionHeatmap data={heatmapData} defaultOpen />

      <div className="flex flex-col gap-2">
        {exercises.map((item, index) => (
          <div key={item.exercise.id}>
            <PreviewExerciseCard
              item={item}
              index={index}
              onRemove={handleRemove}
              onSwap={handleSwap}
              onInfo={(idx) =>
                setInspectedExerciseId(exercises[idx]?.exercise.id ?? null)
              }
              onUpdateSets={handleUpdateSets}
              onUpdateReps={handleUpdateReps}
            />
            {swappingIndex === index && (
              <div className="mt-1">
                <ExerciseSwapPicker
                  pool={exercisePool}
                  currentExerciseIds={currentExerciseIds}
                  muscleGroup={item.exercise.muscle_group}
                  onSelect={handleSwapSelect}
                  onClose={() => setSwappingIndex(null)}
                />
              </div>
            )}
          </div>
        ))}

        {addingExercise ? (
          <ExerciseAddPicker
            pool={exercisePool}
            currentExerciseIds={currentExerciseIds}
            onSelect={handleAddExercise}
            onClose={() => setAddingExercise(false)}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => setAddingExercise(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addExercise")}
          </Button>
        )}
      </div>

      <InspectedExerciseSheet
        exerciseId={inspectedExerciseId}
        onClose={() => setInspectedExerciseId(null)}
      />
    </div>
  )
}

/**
 * Thin wrapper that lazily fetches the full Exercise row (instructions,
 * youtube_url, secondary_muscles) only when the user opens the detail sheet.
 * Hits the per-id cache seeded by `useWorkoutExercises` when applicable.
 *
 * Open is derived from id + resolved data to avoid a dangling sheet when the
 * referenced exercise is unreachable (orphan FK, RLS filter). If the query
 * resolves to null, we clear the id so the parent state stays consistent.
 */
function InspectedExerciseSheet({
  exerciseId,
  onClose,
}: {
  exerciseId: string | null
  onClose: () => void
}) {
  const { data: exercise, isPending } = useExerciseById(exerciseId)

  useEffect(() => {
    if (exerciseId && !isPending && exercise === null) {
      onClose()
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect unreachable-exercise async result into parent id state; no safer place to run this.
  }, [exerciseId, isPending, exercise, onClose])

  return (
    <ExerciseDetailSheet
      exercise={exercise ?? null}
      open={!!exerciseId && !!exercise}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    />
  )
}
