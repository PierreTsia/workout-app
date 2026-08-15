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
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { Input } from "@/components/ui/input"

interface PerRoundGridProps {
  block: ExerciseBlockWithExercises
  dayId: string
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
  requestPersist: RequestCircuitForkPersist
}

export function PerRoundGrid({
  block,
  dayId,
  onMutationStateChange,
  requestPersist,
}: PerRoundGridProps) {
  return (
    <div className="flex flex-col gap-4">
      {block.exercises.map((be) => (
        // Remount when round count changes so the local form reseeds from the
        // resized per_round (no setState-in-effect).
        <PerRoundExerciseRow
          key={`${be.id}:${block.rounds}`}
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

interface CellForm {
  amount: string
  weight: string
}

interface PerRoundExerciseRowProps {
  block: ExerciseBlockWithExercises
  blockExercise: BlockExerciseWithExercise
  rounds: number
  dayId: string
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
  requestPersist: RequestCircuitForkPersist
}

function PerRoundExerciseRow({
  block,
  blockExercise,
  rounds,
  dayId,
  onMutationStateChange,
  requestPersist,
}: PerRoundExerciseRowProps) {
  const { t } = useTranslation("builder")
  const { unit, toDisplay, toKg } = useWeightUnit()
  const { exerciseName } = useCatalogLabels()
  const updatePerRound = useUpdatePerRound()

  const isDuration = blockExercise.exercise?.measurement_type === "duration"

  const [form, setForm] = useState<CellForm[]>(() =>
    seedForm(blockExercise.per_round, rounds, toDisplay),
  )

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const flush = useCallback(
    (cells: CellForm[]) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const perRound: PerRoundCell[] = cells.map((c) => ({
          amount: Math.max(0, Math.round(Number(c.amount) || 0)),
          weight: Math.round(toKg(Number(c.weight) || 0) * 10) / 10,
        }))
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
          () =>
            setForm(seedForm(blockExercise.per_round, rounds, toDisplay)),
        )
      }, 500)
    },
    [
      block,
      blockExercise.id,
      blockExercise.per_round,
      dayId,
      onMutationStateChange,
      requestPersist,
      rounds,
      toDisplay,
      toKg,
      updatePerRound,
    ],
  )

  function handleCellChange(
    roundIdx: number,
    field: keyof CellForm,
    value: string,
  ) {
    const next = form.map((c, i) =>
      i === roundIdx ? { ...c, [field]: value } : c,
    )
    setForm(next)
    flush(next)
  }

  const amountLabel = isDuration ? t("perRoundDuration") : t("perRoundReps")
  const weightLabel = t("weightLabel", { unit })

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <ExerciseThumbnail
          imageUrl={blockExercise.exercise?.image_url ?? null}
          emoji={blockExercise.emoji_snapshot}
          className="h-7 w-7 shrink-0"
        />
        <p className="truncate text-sm font-medium">
          {exerciseName(blockExercise)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid items-center gap-x-2 gap-y-1.5"
          style={{
            gridTemplateColumns: `minmax(4rem, auto) repeat(${rounds}, minmax(3.25rem, 1fr))`,
          }}
        >
          {/* header: empty corner + round labels */}
          <span />
          {form.map((_, roundIdx) => (
            <span
              key={`h-${roundIdx}`}
              className="text-center text-[11px] font-medium text-muted-foreground"
            >
              {t("roundShort", { n: roundIdx + 1 })}
            </span>
          ))}

          {/* amount row */}
          <span className="pr-1 text-xs font-medium text-muted-foreground">
            {amountLabel}
          </span>
          {form.map((cell, roundIdx) => (
            <Input
              key={`a-${roundIdx}`}
              type="number"
              inputMode="numeric"
              min={0}
              value={cell.amount}
              onChange={(e) =>
                handleCellChange(roundIdx, "amount", e.target.value)
              }
              className="h-9 px-1 text-center"
              aria-label={`${amountLabel} ${t("roundShort", { n: roundIdx + 1 })}`}
            />
          ))}

          {/* weight row */}
          <span className="pr-1 text-xs font-medium text-muted-foreground">
            {weightLabel}
          </span>
          {form.map((cell, roundIdx) => (
            <Input
              key={`w-${roundIdx}`}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={cell.weight}
              onChange={(e) =>
                handleCellChange(roundIdx, "weight", e.target.value)
              }
              className="h-9 px-1 text-center"
              aria-label={`${weightLabel} ${t("roundShort", { n: roundIdx + 1 })}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function seedForm(
  perRound: PerRoundCell[],
  rounds: number,
  toDisplay: (kg: number) => number,
): CellForm[] {
  return Array.from({ length: rounds }, (_, i) => {
    const cell = perRound[i] ?? { amount: 0, weight: 0 }
    return {
      amount: String(cell.amount),
      weight: String(Math.round(toDisplay(cell.weight) * 10) / 10),
    }
  })
}
