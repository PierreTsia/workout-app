import { useTranslation } from "react-i18next"
import {
  BodyMap,
  BODY_MAP_INTENSITY_COLORS,
} from "@/components/body-map/BodyMap"
import { DayOutlinePopover } from "@/components/program/DayOutlinePopover"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ProgramBodyMap } from "@/lib/programScore/bodyMapFromIntent"
import { formatDayOutlineCaption } from "@/lib/programScore/dayOutline"
import {
  dominantGoalTracks,
  joinTrackNames,
} from "@/lib/programScore/dominantGoalTracks"
import type { ProgramDayOutline, ProgramScore } from "@/lib/programScore/types"

interface ProgramScoreChipsProps {
  score?: ProgramScore
  bodyMap?: ProgramBodyMap
  days?: readonly ProgramDayOutline[]
  isLoading?: boolean
  featured?: boolean
}

export function ProgramScoreChips({
  score,
  bodyMap,
  days,
  isLoading,
  featured = false,
}: ProgramScoreChipsProps) {
  const { t } = useTranslation("program")

  if (isLoading && score == null) {
    return (
      <div className="flex flex-1 flex-col gap-2" aria-busy="true">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-auto h-16 w-24" />
      </div>
    )
  }

  if (score == null) return null

  const winners = dominantGoalTracks(score)
  const winnerNames = winners.map((track) => t(`track.${track}`))
  const showMap = (bodyMap?.length ?? 0) > 0
  const outlinedDays = (days ?? []).filter(
    (day) => formatDayOutlineCaption(day) !== "",
  )

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        !featured && "flex-1",
        featured && "lg:flex-row lg:items-start lg:gap-8",
      )}
    >
      <div className={cn("flex min-w-0 flex-col gap-2", featured && "lg:flex-1")}>
        <p className="text-sm font-medium">
          {t("facts.line", {
            days: score.facts.dayCount,
            sets: score.facts.setCount,
            circuits: score.facts.circuitCount,
          })}
        </p>

        {winners.length > 0 && (
          <div className="flex min-w-0 items-center gap-1">
            <p className="min-w-0 text-sm">
              <span className="text-muted-foreground">{t("focus.label")}</span>
              {t("focus.separator")}
              <span className="font-medium">{joinTrackNames(winnerNames)}</span>
            </p>
            <ProfileHint label={t("focus.help")} className="max-w-80">
              <div className="flex flex-col gap-2">
                {winners.map((track) => (
                  <p key={track}>
                    {t("focus.fit", {
                      goal: t(`track.${track}`),
                      reason: t(`focus.reason.${track}`),
                    })}
                  </p>
                ))}
              </div>
            </ProfileHint>
          </div>
        )}

        {outlinedDays.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-medium">
            {outlinedDays.map((day, index) => (
              <span key={day.id} className="inline-flex items-baseline gap-x-2">
                {index > 0 && (
                  <span className="font-normal text-muted-foreground" aria-hidden="true">
                    ·
                  </span>
                )}
                <DayOutlinePopover day={day} />
              </span>
            ))}
          </div>
        )}
      </div>

      {showMap && bodyMap != null && (
        <div
          aria-hidden="true"
          data-testid="program-card-body-map"
          className={cn("mt-auto pt-3", featured && "lg:mt-0 lg:pt-0 lg:shrink-0")}
        >
          <BodyMap
            data={[...bodyMap]}
            highlightedColors={BODY_MAP_INTENSITY_COLORS}
            size={featured ? "md" : "sm"}
          />
        </div>
      )}
    </div>
  )
}
