import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import type { ExerciseBlockWithExercises } from "@/types/database"
import { useUpdateBlockMeta } from "@/hooks/useBlockMutations"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { PerRoundGrid } from "@/components/builder/PerRoundGrid"
import { SaveIndicator } from "@/components/builder/SaveIndicator"
import { Input } from "@/components/ui/input"
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
  rounds: string
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

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const flush = useCallback(
    (next: MetaForm, roundsChanged: boolean) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const rounds = parseInt(next.rounds, 10)
        const rest = parseInt(next.rest_seconds, 10)
        const transition = parseInt(next.transition_seconds, 10)
        reportSave("saving")
        updateBlockMeta.mutate(
          {
            blockId: block.id,
            dayId,
            label: next.label.trim() === "" ? null : next.label.trim(),
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
          {
            onSuccess: () => reportSave("saved"),
            onError: () => reportSave("error"),
          },
        )
      }, 500)
    },
    [block.id, block.exercises, dayId, updateBlockMeta, reportSave],
  )

  function handleChange(field: keyof MetaForm, value: string) {
    const next = { ...form, [field]: value }
    setForm(next)
    flush(next, field === "rounds")
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

  const body = (
    <div className="flex flex-col gap-5 overflow-y-auto p-4">
      <FieldGroup label={t("blockLabel")}>
        <Input
          value={form.label}
          onChange={(e) => handleChange("label", e.target.value)}
          placeholder={t("blockDefaultLabel")}
        />
      </FieldGroup>

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

      <PerRoundGrid
        block={block}
        dayId={dayId}
        onMutationStateChange={reportSave}
      />
    </div>
  )

  if (isDesktop) {
    return (
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
    )
  }

  return (
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
  )
}

function seedMeta(block: ExerciseBlockWithExercises): MetaForm {
  return {
    label: block.label ?? "",
    rounds: String(block.rounds),
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
