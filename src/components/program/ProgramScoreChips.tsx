import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ProgramScore, ScoreBand } from "@/lib/programScore/types"

const TRACKS = ["hypertrophy", "strength", "endurance"] as const

const BAND_CLASS: Record<Exclude<ScoreBand, "empty">, string> = {
  short: "text-muted-foreground",
  ok: "border-primary/30 bg-primary/10 text-primary",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
}

interface ProgramScoreChipsProps {
  score?: ProgramScore
  isLoading?: boolean
}

export function ProgramScoreChips({ score, isLoading }: ProgramScoreChipsProps) {
  const { t } = useTranslation("program")

  if (isLoading && score == null) {
    return (
      <div className="flex flex-wrap gap-1.5" aria-busy="true">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    )
  }

  if (score == null) return null

  const trackChips = TRACKS.map((track) => {
    const band = score[track].band
    if (band === "empty") return null
    return {
      key: track,
      label: `${t(`track.${track}`)} · ${t(`band.${band}`)}`,
      className: BAND_CLASS[band],
    }
  }).filter((chip) => chip != null)

  const balanceChip =
    score.balance.kind === "score"
      ? {
          key: "balance",
          label: `${t("track.balance")} ${score.balance.value}`,
          className: "text-foreground",
        }
      : null

  const chips = balanceChip == null ? trackChips : [...trackChips, balanceChip]

  return (
    <div className="flex flex-col gap-1.5">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge
              key={chip.key}
              variant="outline"
              className={cn("w-fit text-[10px] font-medium", chip.className)}
            >
              {chip.label}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("facts.line", {
          days: score.facts.dayCount,
          sets: score.facts.setCount,
          circuits: score.facts.circuitCount,
        })}
      </p>
    </div>
  )
}
