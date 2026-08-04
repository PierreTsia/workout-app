import { useState, useCallback, useRef, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, ArrowLeft, Plus, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CoachRationale } from "@/components/create-program/CoachRationale"
import { PreviewExerciseCard } from "./PreviewExerciseCard"
import { PreviewCircuitCard } from "./PreviewCircuitCard"
import { ExerciseSwapPicker } from "./ExerciseSwapPicker"
import { ExerciseAddPicker } from "./ExerciseAddPicker"
import { ExerciseDetailSheet } from "./ExerciseDetailSheet"
import { useExerciseById } from "@/hooks/useExerciseById"
import type { ExerciseListItem } from "@/types/database"
import type {
  GeneratedDayItem,
  GeneratedExercise,
  GeneratedWorkout,
} from "@/types/generator"
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

function solosFromDayItems(items: GeneratedDayItem[]): GeneratedExercise[] {
  return items.flatMap((item) => (item.kind === "solo" ? [item.exercise] : []))
}

function initialDayItems(workout: GeneratedWorkout): GeneratedDayItem[] {
  if (workout.dayItems && workout.dayItems.length > 0) {
    return workout.dayItems
  }
  return workout.exercises.map((exercise) => ({ kind: "solo" as const, exercise }))
}

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
  const [dayItems, setDayItems] = useState<GeneratedDayItem[]>(() =>
    initialDayItems(workout),
  )
  const [name, setName] = useState(workout.name)
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null)
  const [addingExercise, setAddingExercise] = useState(false)
  const [inspectedExerciseId, setInspectedExerciseId] = useState<string | null>(
    null,
  )
  const lastShuffleRef = useRef(0)

  const exercises = useMemo(() => solosFromDayItems(dayItems), [dayItems])
  const circuitCount = dayItems.filter((i) => i.kind === "circuit").length
  const itemCount = dayItems.length

  const handleRemove = useCallback((index: number) => {
    setDayItems((prev) => prev.filter((_, i) => i !== index))
    setSwappingIndex((prev) => {
      if (prev === null) return null
      if (prev === index) return null
      return prev > index ? prev - 1 : prev
    })
  }, [])

  const handleSwap = useCallback((index: number) => {
    setSwappingIndex(index)
  }, [])

  const handleSwapSelect = useCallback(
    (exercise: ExerciseListItem) => {
      if (swappingIndex === null) return
      setDayItems((prev) =>
        prev.map((item, i) => {
          if (i !== swappingIndex || item.kind !== "solo") return item
          const compound = (exercise.secondary_muscles?.length ?? 0) > 0
          return {
            kind: "solo" as const,
            exercise: {
              exercise,
              sets: item.exercise.sets,
              reps: compound ? COMPOUND_REPS : ISOLATION_REPS,
              restSeconds: compound
                ? COMPOUND_REST_SECONDS
                : ISOLATION_REST_SECONDS,
              isCompound: compound,
            },
          }
        }),
      )
      setSwappingIndex(null)
    },
    [swappingIndex],
  )

  const handleUpdateSets = useCallback((index: number, sets: number) => {
    setDayItems((prev) =>
      prev.map((item, i) =>
        i === index && item.kind === "solo"
          ? { kind: "solo", exercise: { ...item.exercise, sets } }
          : item,
      ),
    )
  }, [])

  const handleUpdateReps = useCallback((index: number, reps: string) => {
    setDayItems((prev) =>
      prev.map((item, i) =>
        i === index && item.kind === "solo"
          ? { kind: "solo", exercise: { ...item.exercise, reps } }
          : item,
      ),
    )
  }, [])

  const handleShuffle = useCallback(() => {
    const now = Date.now()
    if (now - lastShuffleRef.current < SHUFFLE_COOLDOWN_MS) return
    lastShuffleRef.current = now
    onShuffle()
  }, [onShuffle])

  const handleAddExercise = useCallback((exercise: ExerciseListItem) => {
    const compound = (exercise.secondary_muscles?.length ?? 0) > 0
    setDayItems((prev) => {
      const defaultSets =
        prev.find((i) => i.kind === "solo")?.exercise.sets ?? 3
      return [
        ...prev,
        {
          kind: "solo" as const,
          exercise: {
            exercise,
            sets: defaultSets,
            reps: compound ? COMPOUND_REPS : ISOLATION_REPS,
            restSeconds: compound
              ? COMPOUND_REST_SECONDS
              : ISOLATION_REST_SECONDS,
            isCompound: compound,
          },
        },
      ]
    })
    setAddingExercise(false)
  }, [])

  const currentWorkout = useMemo(
    (): GeneratedWorkout => ({
      exercises,
      dayItems,
      name,
      hasFallback: workout.hasFallback,
      ...(workout.rationale ? { rationale: workout.rationale } : {}),
    }),
    [exercises, dayItems, name, workout.hasFallback, workout.rationale],
  )

  const handleStart = useCallback(() => {
    onStart(currentWorkout)
  }, [currentWorkout, onStart])

  const handleSave = useCallback(() => {
    onSave(currentWorkout)
  }, [currentWorkout, onSave])

  const heatmapData = useMemo(() => {
    const solos = exercises.map((ge) => ({
      name: ge.exercise.name,
      muscleGroup: ge.exercise.muscle_group,
      secondaryMuscles: ge.exercise.secondary_muscles,
      sets: ge.sets,
    }))
    const fromCircuits = dayItems.flatMap((item) => {
      if (item.kind !== "circuit") return []
      return item.circuit.exercises.map((nested) => ({
        name: nested.exercise.name,
        muscleGroup: nested.exercise.muscle_group,
        secondaryMuscles: nested.exercise.secondary_muscles,
        sets: item.circuit.rounds,
      }))
    })
    return buildBodyMapData([...solos, ...fromCircuits])
  }, [exercises, dayItems])

  const currentExerciseIds = dayItems.flatMap((item) => {
    if (item.kind === "solo") return [item.exercise.exercise.id]
    return item.circuit.exercises.map((n) => n.exercise.id)
  })

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
          disabled={itemCount === 0 || isBusy}
        >
          {t("startWorkout")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleSave}
          disabled={itemCount === 0 || isBusy}
          className="gap-1.5"
        >
          <Bookmark className="h-4 w-4" />
          {t("saveForLater")}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {circuitCount > 0
            ? t("itemsCountWithCircuits", {
                items: itemCount,
                solos: itemCount - circuitCount,
                circuits: circuitCount,
              })
            : `${itemCount} ${t("exercises")}`}
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
        {dayItems.map((item, index) =>
          item.kind === "circuit" ? (
            <PreviewCircuitCard
              key={`circuit-${index}`}
              circuit={item.circuit}
              index={index}
              onRemove={handleRemove}
            />
          ) : (
            <div key={item.exercise.exercise.id}>
              <PreviewExerciseCard
                item={item.exercise}
                index={index}
                onRemove={handleRemove}
                onSwap={handleSwap}
                onInfo={(idx) => {
                  const target = dayItems[idx]
                  if (target?.kind === "solo") {
                    setInspectedExerciseId(target.exercise.exercise.id)
                  }
                }}
                onUpdateSets={handleUpdateSets}
                onUpdateReps={handleUpdateReps}
              />
              {swappingIndex === index && (
                <div className="mt-1">
                  <ExerciseSwapPicker
                    pool={exercisePool}
                    currentExerciseIds={currentExerciseIds}
                    muscleGroup={item.exercise.exercise.muscle_group}
                    onSelect={handleSwapSelect}
                    onClose={() => setSwappingIndex(null)}
                  />
                </div>
              )}
            </div>
          ),
        )}

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
