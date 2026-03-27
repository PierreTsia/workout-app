import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  TrendingUp,
  Dumbbell,
  Layers,
  Pause,
  ShieldAlert,
  Trophy,
  Clock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ProgressionSuggestion, ProgressionRule } from "@/lib/progression"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { cn } from "@/lib/utils"

const ICON_MAP: Record<ProgressionRule, React.ElementType> = {
  REPS_UP: TrendingUp,
  DURATION_UP: Clock,
  WEIGHT_UP: Dumbbell,
  SETS_UP: Layers,
  HOLD_INCOMPLETE: Pause,
  HOLD_NEAR_FAILURE: ShieldAlert,
  PLATEAU: Trophy,
}

const COLOR_MAP: Record<ProgressionRule, string> = {
  REPS_UP: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  DURATION_UP: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  WEIGHT_UP: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  SETS_UP: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  HOLD_INCOMPLETE: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  HOLD_NEAR_FAILURE: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  PLATEAU: "bg-muted text-muted-foreground border-border",
}

const APPLIED_RULES = new Set<ProgressionRule>(["REPS_UP", "DURATION_UP", "WEIGHT_UP", "SETS_UP"])

interface ProgressionPillProps {
  suggestion: ProgressionSuggestion
}

export function ProgressionPill({ suggestion }: ProgressionPillProps) {
  const { t } = useTranslation("workout")
  const { toDisplay, unit } = useWeightUnit()
  const Icon = ICON_MAP[suggestion.rule]
  const wasAutoApplied = APPLIED_RULES.has(suggestion.rule)

  const displayWeight = Math.round(toDisplay(suggestion.weight) * 10) / 10

  const shortLabel = (() => {
    if (suggestion.delta === "—") return t(suggestion.reasonKey)
    if (suggestion.rule === "WEIGHT_UP") {
      const displayIncrement = Math.round(toDisplay(Number(suggestion.delta)) * 10) / 10
      return `${t(suggestion.reasonKey)} +${displayIncrement} ${unit}`
    }
    return `${t(suggestion.reasonKey)} ${suggestion.delta}`
  })()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer gap-1.5 py-1 text-[11px] font-medium",
            COLOR_MAP[suggestion.rule],
          )}
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          {shortLabel}
        </Badge>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 space-y-2 p-3 text-sm">
        <p className="font-medium">{t(suggestion.reasonKey)}</p>
        <p className="text-muted-foreground">
          {t(
            suggestion.volumeType === "duration" && suggestion.rule !== "DURATION_UP"
              ? `${suggestion.reasonKey}DetailDuration`
              : `${suggestion.reasonKey}Detail`,
            {
              reps: suggestion.reps,
              weight: displayWeight,
              sets: suggestion.sets,
              unit,
              duration: suggestion.duration ?? 0,
            },
          )}
        </p>
        {wasAutoApplied && (
          <p className="text-[11px] text-muted-foreground/70 italic">
            {t("progression.autoAppliedHint")}
          </p>
        )}
        {suggestion.rule === "PLATEAU" && (
          <Link
            to="/create-program"
            className="block text-xs font-medium text-primary underline underline-offset-2"
          >
            {t("progression.tryGenerator")}
          </Link>
        )}
      </PopoverContent>
    </Popover>
  )
}
