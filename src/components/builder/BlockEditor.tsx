import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import type {
  ExerciseBlockMode,
  ExerciseBlockWithExercises,
} from "@/types/database"
import { buildAmrapPersistPayload } from "@/lib/blockPersistence"
import {
  DEFAULT_AMRAP_CAP_MINUTES,
  switchBlockMode,
} from "@/lib/blockTemplate"
import { pendingFromBlock } from "@/lib/circuitFork"
import { useUpdateBlockMeta } from "@/hooks/useBlockMutations"
import { useCircuitForkGate } from "@/hooks/useCircuitForkGate"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { PerRoundGrid } from "@/components/builder/PerRoundGrid"
import { UniformExerciseList } from "@/components/builder/UniformExerciseList"
import { CircuitForkDialog } from "@/components/builder/CircuitForkDialog"
import { SaveIndicator } from "@/components/builder/SaveIndicator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

interface BlockEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  block: ExerciseBlockWithExercises
  dayId: string
  onMutationStateChange: (state: "saving" | "saved" | "error") => void
}

interface MetaForm {
  label: string
  mode: ExerciseBlockMode
  rounds: string
  cap_minutes: string
  rest_seconds: string
  transition_seconds: string
}

export function BlockEditor({
  open,
  onOpenChange,
  block,
  dayId,
  onMutationStateChange,
}: BlockEditorProps) {
  const { t } = useTranslation("builder")
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const updateBlockMeta = useUpdateBlockMeta()
  const {
    forkOpen,
    isPending: forkPending,
    requestPersist,
    confirm: confirmFork,
    onOpenChange: onForkOpenChange,
  } = useCircuitForkGate(block)

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  // Mirror save state locally so it's visible inside the dialog (the builder's
  // page-level indicator is hidden behind it), while still notifying the parent.
  const reportSave = useCallback(
    (state: "saving" | "saved" | "error") => {
      setSaveStatus(state)
      onMutationStateChange(state)
    },
    [onMutationStateChange],
  )

  const [form, setForm] = useState<MetaForm>(() => seedMeta(block))
  const [showPerRoundGrid, setShowPerRoundGrid] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const persist = useCallback(
    (
      input: Parameters<typeof updateBlockMeta.mutate>[0],
      pending: ReturnType<typeof pendingFromBlock>,
    ) => {
      void requestPersist(
        pending,
        () => {
          reportSave("saving")
          updateBlockMeta.mutate(input, {
            onSuccess: () => reportSave("saved"),
            onError: () => reportSave("error"),
          })
        },
        () => setForm(seedMeta(block)),
      )
    },
    [block, requestPersist, updateBlockMeta, reportSave],
  )

  const flush = useCallback(
    (next: MetaForm, roundsChanged: boolean) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const minutes = clampCapMinutes(next.cap_minutes)
        const pending = pendingFromBlock({
          mode: next.mode,
          cap_seconds: next.mode === "amrap" ? minutes * 60 : null,
          exercises: block.exercises,
        })
        if (next.mode === "amrap") {
          const { block: patch } = buildAmrapPersistPayload(
            minutes,
            block.exercises,
          )
          persist(
            {
              blockId: block.id,
              dayId,
              label: next.label.trim() === "" ? null : next.label.trim(),
              ...patch,
            },
            pending,
          )
          return
        }

        const rounds = parseInt(next.rounds, 10)
        const rest = parseInt(next.rest_seconds, 10)
        const transition = parseInt(next.transition_seconds, 10)
        persist(
          {
            blockId: block.id,
            dayId,
            label: next.label.trim() === "" ? null : next.label.trim(),
            mode: "rounds",
            cap_seconds: null,
            rest_seconds: isNaN(rest) ? undefined : Math.max(0, rest),
            transition_seconds: isNaN(transition)
              ? undefined
              : Math.max(0, transition),
            rounds:
              roundsChanged && !isNaN(rounds) && rounds > 0
                ? rounds
                : undefined,
            exercises: roundsChanged
              ? block.exercises.map((be) => ({
                  id: be.id,
                  per_round: be.per_round,
                }))
              : undefined,
          },
          pending,
        )
      }, 500)
    },
    [block.exercises, block.id, dayId, persist],
  )

  function handleChange(field: keyof MetaForm, value: string) {
    const next = { ...form, [field]: value }
    setForm(next)
    flush(next, field === "rounds")
  }

  function handleModeChange(nextMode: ExerciseBlockMode) {
    const switched = switchBlockMode(
      {
        mode: form.mode,
        rounds: parseInt(form.rounds, 10) || block.rounds,
        cap_seconds:
          form.mode === "amrap"
            ? clampCapMinutes(form.cap_minutes) * 60
            : null,
        rest_seconds: parseInt(form.rest_seconds, 10) || 0,
        transition_seconds: parseInt(form.transition_seconds, 10) || 0,
        exercises: block.exercises,
      },
      nextMode,
    )
    const nextForm: MetaForm = {
      ...form,
      mode: switched.mode,
      rounds: String(switched.rounds),
      cap_minutes: String(
        switched.cap_seconds !== null
          ? switched.cap_seconds / 60
          : DEFAULT_AMRAP_CAP_MINUTES,
      ),
      rest_seconds: String(switched.rest_seconds),
      transition_seconds: String(switched.transition_seconds),
    }
    setForm(nextForm)
    setShowPerRoundGrid(false)

    const exercises = switched.exercises.map((ex, i) => ({
      id: block.exercises[i].id,
      per_round: ex.per_round,
    }))
    const pending = pendingFromBlock({
      mode: switched.mode,
      cap_seconds: switched.cap_seconds,
      exercises: block.exercises.map((be, i) => ({
        id: be.id,
        exercise_id: be.exercise_id,
        per_round: switched.exercises[i].per_round,
      })),
    })
    if (switched.mode === "amrap") {
      const { block: patch, exercises: amrapExercises } =
        buildAmrapPersistPayload(
          (switched.cap_seconds ?? DEFAULT_AMRAP_CAP_MINUTES * 60) / 60,
          exercises,
        )
      persist(
        {
          blockId: block.id,
          dayId,
          label: nextForm.label.trim() === "" ? null : nextForm.label.trim(),
          ...patch,
          exercises: amrapExercises,
        },
        pending,
      )
      return
    }
    persist(
      {
        blockId: block.id,
        dayId,
        label: nextForm.label.trim() === "" ? null : nextForm.label.trim(),
        mode: "rounds",
        cap_seconds: null,
        rounds: switched.rounds,
        rest_seconds: switched.rest_seconds,
        transition_seconds: switched.transition_seconds,
        exercises,
      },
      pending,
    )
  }

  const statusEl =
    saveStatus === "saving" ? (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("saving")}
      </span>
    ) : (
      <SaveIndicator status={saveStatus} />
    )

  const capMinutes = clampCapMinutes(form.cap_minutes)
  const isAmrap = form.mode === "amrap"
  const modeItemClass =
    "h-auto min-h-11 flex-1 flex-col gap-0.5 py-2.5 data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground"

  const body = (
    <div className="flex flex-col gap-5 overflow-y-auto p-4">
      <ToggleGroup
        type="single"
        value={form.mode}
        onValueChange={(value) => {
          if (value === "rounds" || value === "amrap") {
            handleModeChange(value)
          }
        }}
        variant="outline"
        className="grid w-full grid-cols-2 gap-0"
      >
        <ToggleGroupItem
          value="rounds"
          aria-label={`${t("rounds")}. ${t("toursModeHint")}`}
          className={cn(modeItemClass, "rounded-r-none")}
        >
          <span>{t("rounds")}</span>
          <span className="text-[10px] font-normal opacity-70">
            {t("toursModeHint")}
          </span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="amrap"
          aria-label={`AMRAP ${capMinutes} min. ${t("amrapGloss")}`}
          className={cn(modeItemClass, "-ml-px rounded-l-none")}
        >
          <span>{t("amrap")}</span>
          <span className="text-[10px] font-normal opacity-70">
            {t("amrapGloss")}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>

      <FieldGroup label={t("blockLabel")}>
        <Input
          value={form.label}
          onChange={(e) => handleChange("label", e.target.value)}
          placeholder={t("blockDefaultLabel")}
        />
      </FieldGroup>

      {isAmrap ? (
        <FieldGroup label={t("amrapCapMinutes")}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={form.cap_minutes}
            onChange={(e) => handleChange("cap_minutes", e.target.value)}
          />
        </FieldGroup>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={t("rounds")}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.rounds}
              onChange={(e) => handleChange("rounds", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label={t("restBetweenRounds")}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={15}
              value={form.rest_seconds}
              onChange={(e) => handleChange("rest_seconds", e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label={t("transitionBetweenExercises")}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={5}
              value={form.transition_seconds}
              onChange={(e) =>
                handleChange("transition_seconds", e.target.value)
              }
            />
          </FieldGroup>
        </div>
      )}

      {isAmrap || !showPerRoundGrid ? (
        <UniformExerciseList
          block={block}
          dayId={dayId}
          onMutationStateChange={reportSave}
          requestPersist={requestPersist}
        />
      ) : (
        <PerRoundGrid
          block={block}
          dayId={dayId}
          onMutationStateChange={reportSave}
          requestPersist={requestPersist}
        />
      )}
      {!isAmrap && !showPerRoundGrid && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowPerRoundGrid(true)}
        >
          {t("customizePerRound")}
        </Button>
      )}
    </div>
  )

  const forkDialog = (
    <CircuitForkDialog
      open={forkOpen}
      onOpenChange={onForkOpenChange}
      onConfirm={() => {
        void confirmFork()
      }}
      isPending={forkPending}
    />
  )

  if (isDesktop) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            aria-describedby={undefined}
            className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0"
          >
            <DialogHeader className="shrink-0 px-4 pt-4 pb-2">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle>{t("editBlock")}</DialogTitle>
                <span className="flex h-5 items-center">{statusEl}</span>
              </div>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
        {forkDialog}
      </>
    )
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[85vh] flex-col gap-0 p-0">
          <DrawerHeader className="shrink-0 px-4 pt-2 pb-0">
            <div className="flex items-center justify-between gap-2">
              <DrawerTitle>{t("editBlock")}</DrawerTitle>
              <span className="flex h-5 items-center">{statusEl}</span>
            </div>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
      {forkDialog}
    </>
  )
}

function clampCapMinutes(raw: string): number {
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) return DEFAULT_AMRAP_CAP_MINUTES
  return Math.min(60, Math.max(1, parsed))
}

function seedMeta(block: ExerciseBlockWithExercises): MetaForm {
  return {
    label: block.label ?? "",
    mode: block.mode,
    rounds: String(block.rounds),
    cap_minutes: String(
      block.cap_seconds !== null
        ? block.cap_seconds / 60
        : DEFAULT_AMRAP_CAP_MINUTES,
    ),
    rest_seconds: String(block.rest_seconds),
    transition_seconds: String(block.transition_seconds),
  }
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
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
