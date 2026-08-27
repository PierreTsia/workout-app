import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { Card, CardContent } from "@/components/ui/card"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import type { ProgramIntentScore } from "@/lib/programScore/hypertrophyExample"
import type { ScoreBand } from "@/lib/programScore/types"
import {
  BALANCE_BAND_COLOR,
  balanceBandFromScore,
} from "@/lib/trainingBalance"
import { cn } from "@/lib/utils"

const TRACKS = ["hypertrophy", "strength", "endurance"] as const

const BAND_FILL: Record<Exclude<ScoreBand, "empty">, number> = {
  short: 28,
  ok: 62,
  high: 92,
}

const BAND_BAR: Record<Exclude<ScoreBand, "empty">, string> = {
  short: "bg-muted-foreground/50",
  ok: "bg-orange-500",
  high: "bg-primary",
}

function bandLabel(
  t: (key: string) => string,
  band: ScoreBand,
): string | null {
  if (band === "empty") return null
  return t(`band.${band}`)
}

function Meter({
  fill,
  barClass,
  barStyle,
}: {
  fill: number
  barClass?: string
  barStyle?: CSSProperties
}) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", barClass)}
        style={{ width: `${fill}%`, ...barStyle }}
      />
    </div>
  )
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
    <div className="grid gap-3 lg:grid-cols-3">
      {TRACKS.map((track) => {
        const band = score[track].band
        const showExample =
          track === "hypertrophy" && example != null && hypertrophyBand != null

        return (
          <Card key={track}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {t(`track.${track}`)}
                </p>
                <ProfileHint label={t("focus.help")}>
                  <div className="flex flex-col gap-2">
                    <p>{t(`rubric.${track}`)}</p>
                    {showExample && (
                      <p>
                        {t("example.hypertrophy", {
                          muscle: muscleLabel(example.muscle),
                          sets: example.sets,
                          days: example.days,
                          band: t(`band.${example.band}`),
                        })}
                      </p>
                    )}
                  </div>
                </ProfileHint>
              </div>
              {band !== "empty" && (
                <>
                  <Meter fill={BAND_FILL[band]} barClass={BAND_BAR[band]} />
                  <p className="text-xs text-muted-foreground">
                    {t(`band.${band}`)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )
      })}

      <Card className="lg:col-span-3">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t("track.balance")}</p>
            <ProfileHint label={t("balance.help")}>
              <p>{t("rubric.balance")}</p>
            </ProfileHint>
          </div>
          {score.balance.kind === "score" && balanceBand != null && (
            <>
              <Meter
                fill={score.balance.value}
                barStyle={{ backgroundColor: BALANCE_BAND_COLOR[balanceBand] }}
              />
              <p
                className="text-sm font-medium tabular-nums"
                style={{ color: BALANCE_BAND_COLOR[balanceBand] }}
              >
                {score.balance.value}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
