import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LeftoverStepperProps {
  max: number
  initial: number
  unit: "reps" | "seconds"
  onConfirm: (actual: number) => void
}

export function LeftoverStepper({
  max,
  initial,
  unit,
  onConfirm,
}: LeftoverStepperProps) {
  const { t } = useTranslation("workout")
  const [value, setValue] = useState(() =>
    Math.min(max, Math.max(0, initial)),
  )
  const unitLabel =
    unit === "seconds" ? t("blockRunner.secondsUnit") : t("blockRunner.repsUnit")

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-bold">{t("blockRunner.leftoverTitle")}</h2>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("blockRunner.decrement")}
          disabled={value <= 0}
          onClick={() => setValue((n) => Math.max(0, n - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="flex min-w-16 items-baseline justify-center gap-1">
          <span className="text-5xl font-bold tabular-nums">{value}</span>
          <span className="text-lg font-semibold text-muted-foreground">
            {unitLabel}
          </span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("blockRunner.increment")}
          disabled={value >= max}
          onClick={() => setValue((n) => Math.min(max, n + 1))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <Button
        size="lg"
        className="gap-1.5"
        onClick={() => onConfirm(value)}
      >
        <Check className="h-5 w-5" />
        {t("blockRunner.leftoverConfirm")}
      </Button>
    </div>
  )
}
