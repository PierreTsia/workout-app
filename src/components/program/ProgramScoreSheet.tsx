import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { BAND_CLASS } from "@/components/program/bandStyles"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import type { ProgramIntentScore } from "@/lib/programScore/hypertrophyExample"
import type { ScoreBand } from "@/lib/programScore/types"
import {
  BALANCE_BAND_COLOR,
  balanceBandFromScore,
} from "@/lib/trainingBalance"
import { cn } from "@/lib/utils"

const TRACKS = ["hypertrophy", "strength", "endurance"] as const

function bandLabel(
  t: (key: string) => string,
  band: ScoreBand,
): string | null {
  if (band === "empty") return null
  return t(`band.${band}`)
}

export function ProgramScoreSheet({ score }: { score: ProgramIntentScore }) {
  const { t } = useTranslation("program")
  const { muscleLabel } = useCatalogLabels()
  const example = score.hypertrophyExample
  const hypertrophyBand = bandLabel(t, score.hypertrophy.band)
  const balanceBand =
    score.balance.kind === "score"
      ? balanceBandFromScore(score.balance.value)
      : null

  return (
    <div className="flex flex-col gap-3">
      {TRACKS.map((track) => {
        const band = score[track].band
        const label = bandLabel(t, band)
        const expandable = track === "hypertrophy" && example != null && hypertrophyBand != null

        const header = (
          <>
            <CardTitle className="text-sm font-medium leading-tight">
              {t(`track.${track}`)}
            </CardTitle>
            <div className="flex shrink-0 items-center gap-1">
              {label != null && band !== "empty" && (
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-medium", BAND_CLASS[band])}
                >
                  {label}
                </Badge>
              )}
              {expandable && (
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </div>
          </>
        )

        return (
          <Card key={track}>
            <Collapsible>
              <CardHeader className="p-4 pb-2">
                {expandable ? (
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
                    {header}
                  </CollapsibleTrigger>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    {header}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm text-muted-foreground">
                  {t(`rubric.${track}`)}
                </p>
                {expandable && (
                  <CollapsibleContent className="pt-2">
                    <p className="text-sm text-muted-foreground">
                      {t("example.hypertrophy", {
                        muscle: muscleLabel(example.muscle),
                        sets: example.sets,
                        days: example.days,
                        band: t(`band.${example.band}`),
                      })}
                    </p>
                  </CollapsibleContent>
                )}
              </CardContent>
            </Collapsible>
          </Card>
        )
      })}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 pb-2">
          <CardTitle className="text-sm font-medium leading-tight">
            {t("track.balance")}
          </CardTitle>
          {score.balance.kind === "score" && balanceBand != null && (
            <Badge
              variant="outline"
              className="text-[10px] font-medium tabular-nums"
              style={{
                color: BALANCE_BAND_COLOR[balanceBand],
                borderColor: BALANCE_BAND_COLOR[balanceBand],
              }}
            >
              {score.balance.value}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-sm text-muted-foreground">{t("rubric.balance")}</p>
        </CardContent>
      </Card>
    </div>
  )
}
