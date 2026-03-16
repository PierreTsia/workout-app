import { useState, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, ArrowLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PreviewExerciseCard } from "./PreviewExerciseCard"
import { ExerciseSwapPicker } from "./ExerciseSwapPicker"
import { ExerciseAddPicker } from "./ExerciseAddPicker"
import { ExerciseDetailSheet } from "./ExerciseDetailSheet"
import type { Exercise } from "@/types/database"
import type { GeneratedExercise, GeneratedWorkout } from "@/types/generator"
import {
  COMPOUND_REPS,
  COMPOUND_REST_SECONDS,
  ISOLATION_REPS,
  ISOLATION_REST_SECONDS,
} from "@/lib/generatorConfig"

interface PreviewStepProps {
  workout: GeneratedWorkout
  exercisePool: Exercise[]
  onStart: (workout: GeneratedWorkout) => void
  onShuffle: () => void
  onBack: () => void
  isStarting: boolean
}

const SHUFFLE_COOLDOWN_MS = 1000

export function PreviewStep({
  workout,
  exercisePool,
  onStart,
  onShuffle,
  onBack,
  isStarting,
}: PreviewStepProps) {
  const { t } = useTranslation("generator")
  const [exercises, setExercises] = useState<GeneratedExercise[]>(
    workout.exercises,
  )
  const [name, setName] = useState(workout.name)
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null)
  const lastShuffleRef = useRef(0)

  const handleRemove = useCallback((index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSwap = useCallback((index: number) => {
    setSwappingIndex(index)
  }, [])

  const handleSwapSelect = useCallback(
    (exercise: Exercise) => {
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
    (exercise: Exercise) => {
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

  const handleStart = useCallback(() => {
    onStart({ exercises, name, fallbackNotice: workout.fallbackNotice })
  }, [exercises, name, workout.fallbackNotice, onStart])

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

      {workout.fallbackNotice && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          {workout.fallbackNotice}
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={handleStart}
        disabled={exercises.length === 0 || isStarting}
      >
        {isStarting ? t("starting") : t("startWorkout")}
      </Button>

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

      <div className="flex flex-col gap-2">
        {exercises.map((item, index) => (
          <div key={item.exercise.id}>
            <PreviewExerciseCard
              item={item}
              index={index}
              onRemove={handleRemove}
              onSwap={handleSwap}
              onInfo={setInspectedIndex}
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

      <ExerciseDetailSheet
        exercise={
          inspectedIndex !== null
            ? exercises[inspectedIndex]?.exercise ?? null
            : null
        }
        open={inspectedIndex !== null}
        onOpenChange={(open) => {
          if (!open) setInspectedIndex(null)
        }}
      />
    </div>
  )
}
