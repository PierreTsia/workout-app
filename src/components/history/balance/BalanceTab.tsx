import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { useVolumeDistribution } from "@/hooks/useVolumeDistribution"
import type { VolumeDistributionData } from "@/hooks/useVolumeDistribution"
import {
  balanceBandFromScore,
  computeBalanceScore,
  computePairInsights,
  setsRecordFromRows,
  setsVectorFromRows,
} from "@/lib/trainingBalance"
import {
  bodyMapDataFromMuscleVolume,
  hasEnoughBalanceData,
} from "@/lib/volumeByMuscleGroup"
import { BodyMap, BODY_MAP_INTENSITY_COLORS } from "@/components/body-map/BodyMap"
import { BalanceGauge } from "./BalanceGauge"
import { BalanceInsights } from "./BalanceInsights"
import { MuscleBreakdownTable } from "./MuscleBreakdownTable"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const WINDOW_DAYS = 30

function computeBalanceDerived(data: VolumeDistributionData, t: TFunction<"history">) {
  const currentOk = hasEnoughBalanceData(data.current)
  const vec = setsVectorFromRows(data.current.muscles)
  const score = computeBalanceScore(vec)
  const band = balanceBandFromScore(score)
  const bandLabel = t(`balance.band.${band}`)

  const prevVec = setsVectorFromRows(data.previous.muscles)
  const prevScore = computeBalanceScore(prevVec)
  const prevOk =
    data.previous.finished_sessions >= 3 &&
    data.previous.muscles.some((m) => m.total_sets > 0)

  const deltaPct = prevOk ? score - prevScore : null
  const deltaLabel =
    deltaPct === null
      ? null
      : deltaPct === 0
        ? t("balance.deltaSame")
        : deltaPct > 0
          ? t("balance.deltaUp", { value: Math.abs(deltaPct) })
          : t("balance.deltaDown", { value: Math.abs(deltaPct) })

  const pairInsights = currentOk
    ? computePairInsights(setsRecordFromRows(data.current.muscles))
    : []

  const bodyMapData = currentOk
    ? bodyMapDataFromMuscleVolume(data.current.muscles)
    : []

  return {
    currentOk,
    score,
    band,
    bandLabel,
    deltaPct,
    deltaLabel,
    pairInsights,
    bodyMapData,
  }
}

export function BalanceTab() {
  const { t } = useTranslation("history")
  const { data, isLoading, isError, error } = useVolumeDistribution(WINDOW_DAYS)

  const derived = data ? computeBalanceDerived(data, t) : null

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error instanceof Error ? error.message : t("balance.loadError")}
      </p>
    )
  }

  if (!data || !derived) return null

  if (!derived.currentOk) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6">
          <p className="font-medium">{t("balance.notEnoughDataTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("balance.notEnoughDataBody", { days: WINDOW_DAYS })}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {t("balance.windowDays", { days: WINDOW_DAYS })}
      </p>

      <div className="grid min-w-0 gap-6 md:grid-cols-2 md:items-start">
        <div className="min-w-0 w-full">
          <BalanceGauge
            score={derived.score}
            band={derived.band}
            bandLabel={derived.bandLabel}
            deltaPct={derived.deltaPct}
            deltaLabel={derived.deltaLabel}
          />
        </div>
        <div className="flex flex-col items-center gap-2 md:items-end">
          <BodyMap
            data={derived.bodyMapData}
            highlightedColors={BODY_MAP_INTENSITY_COLORS}
            className="max-w-[280px]"
          />
          <p className="max-w-[280px] text-center text-xs text-muted-foreground md:text-right">
            {t("balance.bodyMapIntensityHint")}
          </p>
        </div>
      </div>

      <BalanceInsights
        band={derived.band}
        pairInsights={derived.pairInsights}
        muscles={data.current.muscles}
      />

      <Card>
        <CardContent className="pt-4">
          <MuscleBreakdownTable muscles={data.current.muscles} />
        </CardContent>
      </Card>
    </div>
  )
}
