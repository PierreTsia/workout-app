import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  TrendingUp,
  Dumbbell,
  Layers,
  Pause,
  ShieldAlert,
  Trophy,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ProgressionSuggestion, ProgressionRule } from "@/lib/progression"
import { cn } from "@/lib/utils"

const ICON_MAP: Record<ProgressionRule, React.ElementType> = {
  REPS_UP: TrendingUp,
  WEIGHT_UP: Dumbbell,
  SETS_UP: Layers,
  HOLD_INCOMPLETE: Pause,
  HOLD_NEAR_FAILURE: ShieldAlert,
  PLATEAU: Trophy,
}

const COLOR_MAP: Record<ProgressionRule, string> = {
  REPS_UP: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  WEIGHT_UP: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  SETS_UP: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  HOLD_INCOMPLETE: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  HOLD_NEAR_FAILURE: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  PLATEAU: "bg-muted text-muted-foreground border-border",
}

const APPLIED_RULES = new Set<ProgressionRule>(["REPS_UP", "WEIGHT_UP", "SETS_UP"])

interface ProgressionPillProps {
  suggestion: ProgressionSuggestion
}

export function ProgressionPill({ suggestion }: ProgressionPillProps) {
  const { t } = useTranslation("workout")
  const Icon = ICON_MAP[suggestion.rule]
  const wasAutoApplied = APPLIED_RULES.has(suggestion.rule)

  const shortLabel =
    suggestion.delta !== "—"
      ? `${t(suggestion.reasonKey)} ${suggestion.delta}`
      : t(suggestion.reasonKey)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none transition-colors",
            COLOR_MAP[suggestion.rule],
          )}
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          {shortLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 space-y-2 p-3 text-sm">
        <p className="font-medium">{t(suggestion.reasonKey)}</p>
        <p className="text-muted-foreground">
          {t(`${suggestion.reasonKey}Detail`, {
            reps: suggestion.reps,
            weight: suggestion.weight,
            sets: suggestion.sets,
          })}
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
