import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type {
  BlockExerciseWithExercise,
  ExerciseBlockWithExercises,
  PerRoundCell,
} from "@/types/database"
import { pendingFromBlock } from "@/lib/circuitFork"
import { useUpdatePerRound } from "@/hooks/useBlockMutations"
import type { RequestCircuitForkPersist } from "@/hooks/useCircuitForkGate"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { Input } from "@/components/ui/input"

interface UniformExerciseListProps {
  block: ExerciseBlockWithExercises
  dayId: string
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
  requestPersist: RequestCircuitForkPersist
}

/** One amount/weight per exercise. Tours writes the cell across every round. */
export function UniformExerciseList({
  block,
  dayId,
  onMutationStateChange,
  requestPersist,
}: UniformExerciseListProps) {
  return (
    <div className="flex flex-col gap-3">
      {block.exercises.map((be) => (
        <UniformExerciseRow
          key={be.id}
          block={block}
          blockExercise={be}
          rounds={block.rounds}
          dayId={dayId}
          onMutationStateChange={onMutationStateChange}
          requestPersist={requestPersist}
        />
      ))}
    </div>
  )
}

function UniformExerciseRow({
  block,
  blockExercise,
  rounds,
  dayId,
  onMutationStateChange,
  requestPersist,
}: {
  block: ExerciseBlockWithExercises
  blockExercise: BlockExerciseWithExercise
  rounds: number
  dayId: string
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
  requestPersist: RequestCircuitForkPersist
}) {
  const { t } = useTranslation("builder")
  const { unit, toDisplay, toKg } = useWeightUnit()
  const { exerciseName } = useCatalogLabels()
  const updatePerRound = useUpdatePerRound()
  const isDuration = blockExercise.exercise?.measurement_type === "duration"
  const seed = blockExercise.per_round[0] ?? { amount: 0, weight: 0 }

  const [amount, setAmount] = useState(String(seed.amount))
  const [weight, setWeight] = useState(
    String(Math.round(toDisplay(seed.weight) * 10) / 10),
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const flush = useCallback(
    (nextAmount: string, nextWeight: string) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const cell: PerRoundCell = {
          amount: Math.max(0, Math.round(Number(nextAmount) || 0)),
          weight: Math.round(toKg(Number(nextWeight) || 0) * 10) / 10,
        }
        const perRound = Array.from({ length: rounds }, () => ({ ...cell }))
        const pending = pendingFromBlock(block, {
          blockExerciseId: blockExercise.id,
          per_round: perRound,
        })
        void requestPersist(
          pending,
          () => {
            onMutationStateChange("saving")
            updatePerRound.mutate(
              { blockExerciseId: blockExercise.id, dayId, perRound },
              {
                onSuccess: () => onMutationStateChange("saved"),
                onError: () => onMutationStateChange("error"),
              },
            )
          },
          () => {
            setAmount(String(seed.amount))
            setWeight(String(Math.round(toDisplay(seed.weight) * 10) / 10))
          },
        )
      }, 500)
    },
    [
      block,
      blockExercise.id,
      dayId,
      onMutationStateChange,
      requestPersist,
      rounds,
      seed.amount,
      seed.weight,
      toDisplay,
      toKg,
      updatePerRound,
    ],
  )

  const amountLabel = isDuration ? t("perRoundDuration") : t("perRoundReps")
  const weightLabel = t("weightLabel", { unit })

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <p className="truncate text-sm font-medium">{exerciseName(blockExercise)}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {amountLabel}
          </span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              flush(e.target.value, weight)
            }}
            aria-label={`${amountLabel} ${exerciseName(blockExercise)}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {weightLabel}
          </span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value)
              flush(amount, e.target.value)
            }}
            aria-label={`${weightLabel} ${exerciseName(blockExercise)}`}
          />
        </label>
      </div>
    </div>
  )
}
