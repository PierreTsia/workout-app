import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import {
  type BalanceBand,
  type MuscleTaxonomy,
  type PairInsight,
  zeroVolumeMuscles,
} from "@/lib/trainingBalance"
import type { VolumeByMuscleRow } from "@/lib/volumeByMuscleGroup"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function muscleLabel(t: TFunction<"catalog">, m: MuscleTaxonomy) {
  return t(`muscles.${m}`)
}

interface BalanceInsightsProps {
  band: BalanceBand
  pairInsights: PairInsight[]
  muscles: readonly VolumeByMuscleRow[]
}

export function BalanceInsights({
  band,
  pairInsights,
  muscles,
}: BalanceInsightsProps) {
  const { t } = useTranslation("history")
  const { t: tCatalog } = useTranslation("catalog")

  const untrainedFocus = new Set(
    pairInsights
      .filter((i) => i.kind === "untrained")
      .map((i) => i.focusMuscle),
  )

  const extraZeros = zeroVolumeMuscles(muscles).filter(
    (m) => !untrainedFocus.has(m),
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("balance.insightsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p className="text-foreground">{t(`balance.summary.${band}`)}</p>

        {pairInsights.map((insight) => (
          <p key={insight.pairName} className="border-l-2 border-primary/40 pl-3">
            {insight.kind === "untrained"
              ? t("balance.insightUntrained", {
                  weak: muscleLabel(tCatalog, insight.focusMuscle),
                  strong: muscleLabel(tCatalog, insight.otherMuscle),
                })
              : t("balance.insightSkewed", {
                  strong: muscleLabel(tCatalog, insight.focusMuscle),
                  weak: muscleLabel(tCatalog, insight.otherMuscle),
                })}
          </p>
        ))}

        {extraZeros.map((m) => (
          <p key={m} className="border-l-2 border-muted-foreground/30 pl-3">
            {t("balance.zeroVolume", { muscle: muscleLabel(tCatalog, m) })}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
