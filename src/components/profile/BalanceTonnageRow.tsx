import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { BalanceScoreBar } from "@/components/profile/BalanceScoreBar"
import { MuscleSetRanks } from "@/components/profile/MuscleSetRanks"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { ProfileSection } from "@/components/profile/ProfileSection"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import {
  RADAR_CURRENT,
  RADAR_PRIOR,
  radarBalanceScore,
} from "@/components/profile/charts/fixtures"
import { MuscleRadarChart } from "@/components/profile/charts/MuscleRadarChart"
import { scaleRadarCredits } from "@/components/profile/charts/profileChartData"
import { TonnageBarChart } from "@/components/profile/charts/TonnageBarChart"
import { useProfileLiveQueries } from "@/hooks/useProfileSnapshot"
import { useVolumeByMuscleGroupAllTime } from "@/hooks/useVolumeByMuscleGroupAllTime"
import { useVolumeDistribution } from "@/hooks/useVolumeDistribution"
import { buildTonnageVmFromRollups } from "@/lib/profile/allTimeRollups"
import { buildBalanceVm } from "@/lib/profile/balance"
import { buildTonnageVm, formatTonnes, pierreTonnageBars } from "@/lib/profile/tonnage"
import { MIX_CATEGORIES } from "@/lib/profile/window"
import {
  isoDayInTimeZone,
  profileWindowRange,
} from "@/lib/profile/windowRange"
import { balanceBandFromScore } from "@/lib/trainingBalance"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { cn } from "@/lib/utils"
import { authAtom } from "@/store/atoms"

export type BalanceTonnageFixtureMode = "pierre" | "empty" | "loading"

const VOLUME_DAYS = {
  "7": 7,
  "30": 30,
  "100": 100,
  "365": 365,
} as const

function fixtureDeltaLabel(
  t: (key: string, opts?: Record<string, string | number>) => string,
  delta: number,
  formatted: string | number,
) {
  if (delta === 0) return t("pulse.deltaEven")
  if (delta < 0) return t("pulse.deltaDown", { n: formatted })
  return t("pulse.delta", { n: formatted })
}

export function BalanceTonnageRow({ mode }: { mode: BalanceTonnageFixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const { snapshotQuery, rollupsQuery, boundedKind, liveBounded, liveAll } =
    useProfileLiveQueries(kind, mode === "pierre" && user != null)
  const volumeQuery = useVolumeDistribution(
    boundedKind == null ? 30 : VOLUME_DAYS[boundedKind],
    { includePrevious: includeDeltas, enabled: liveBounded },
  )
  const volumeAllQuery = useVolumeByMuscleGroupAllTime({ enabled: liveAll })

  const timeZone = getResolvedIANATimeZone()
  const liveBalance =
    liveBounded && volumeQuery.data != null
      ? buildBalanceVm(
          volumeQuery.data.current,
          includeDeltas ? volumeQuery.data.previous : null,
          includeDeltas,
        )
      : liveAll && volumeAllQuery.data != null
        ? buildBalanceVm(volumeAllQuery.data, null, false)
        : null
  const liveTonnage =
    liveBounded && snapshotQuery.data != null && boundedKind != null
      ? buildTonnageVm(snapshotQuery.data, {
          kind: boundedKind,
          ...profileWindowRange(boundedKind, isoDayInTimeZone(new Date(), timeZone)),
          includeDeltas,
          timeZone,
        })
      : liveAll && rollupsQuery.data != null
        ? buildTonnageVmFromRollups(rollupsQuery.data)
        : null

  const fixtureScore = radarBalanceScore(RADAR_CURRENT)
  const fixtureScoreDelta = fixtureScore - radarBalanceScore(RADAR_PRIOR)
  const fixtureRadar = scaleRadarCredits(RADAR_CURRENT)
  const fixturePrior = scaleRadarCredits(RADAR_PRIOR)

  const balanceStatus =
    mode === "loading" ||
    (liveBounded && volumeQuery.isPending) ||
    (liveAll && volumeAllQuery.isPending)
      ? "loading"
      : mode === "empty"
        ? "empty"
        : (liveBounded && volumeQuery.isError) || (liveAll && volumeAllQuery.isError)
          ? "error"
          : liveBalance != null
            ? liveBalance.status
            : "ok"

  const tonnageStatus =
    mode === "loading" ||
    (liveBounded && snapshotQuery.isPending) ||
    (liveAll && rollupsQuery.isPending)
      ? "loading"
      : mode === "empty"
        ? "empty"
        : (liveBounded && snapshotQuery.isError) || (liveAll && rollupsQuery.isError)
          ? "error"
          : liveTonnage != null
            ? liveTonnage.status
            : "ok"

  const score = liveBalance?.status === "ok" ? liveBalance.score : fixtureScore
  const scoreDelta =
    liveBalance?.status === "ok" ? liveBalance.scoreDelta : fixtureScoreDelta
  const radarCurrent =
    liveBalance?.status === "ok" ? liveBalance.current : fixtureRadar
  const radarPrior =
    liveBalance?.status === "ok" ? liveBalance.prior : fixturePrior
  const tonnesLabel =
    liveTonnage?.status === "ok" ? formatTonnes(liveTonnage.tonnes) : "18.4 t"
  const tonnesDelta =
    liveTonnage?.status === "ok" ? liveTonnage.deltaTonnes : 1.2
  const tonnageCategories =
    liveTonnage?.status === "ok" ? liveTonnage.categories : MIX_CATEGORIES[kind]
  const tonnageBars =
    liveTonnage?.status === "ok" ? liveTonnage.bars : pierreTonnageBars(kind)

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
      <ProfileSection
        title={t("balance.title")}
        hint={
          <ProfileHint label={t("about", { section: t("balance.title") })}>
            {t("balance.hint")}
          </ProfileHint>
        }
        meta={
          balanceStatus === "ok" && includeDeltas && scoreDelta != null ? (
            <span
              className={cn(
                "font-medium",
                scoreDelta > 0 && "text-emerald-600 dark:text-emerald-400",
                scoreDelta < 0 && "text-destructive",
                scoreDelta === 0 && "text-muted-foreground",
              )}
            >
              {fixtureDeltaLabel(t, scoreDelta, Math.abs(scoreDelta))}
            </span>
          ) : undefined
        }
        status={balanceStatus}
        empty={t("balance.empty")}
        error={t("error")}
      >
        <BalanceScoreBar
          score={score}
          label={t("balance.score", { score })}
          bandLabel={t(`balance.band.${balanceBandFromScore(score)}`)}
        />
        <div className="@container min-w-0">
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 @min-[28rem]:grid-cols-[minmax(0,1fr)_9.5rem] @min-[28rem]:items-center">
            <MuscleRadarChart
              series={{
                current: radarCurrent,
                prior: includeDeltas ? radarPrior : undefined,
              }}
            />
            <MuscleSetRanks values={radarCurrent} />
          </div>
        </div>
      </ProfileSection>
      <ProfileSection
        title={t("tonnage.title")}
        hint={
          <ProfileHint label={t("about", { section: t("tonnage.title") })}>
            {t("tonnage.hint")}
          </ProfileHint>
        }
        status={tonnageStatus}
        empty={t("tonnage.empty")}
        error={t("error")}
      >
        <p className="text-3xl font-bold tracking-tight">{tonnesLabel}</p>
        {includeDeltas && tonnesDelta != null ? (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              tonnesDelta > 0 && "text-emerald-600 dark:text-emerald-400",
              tonnesDelta < 0 && "text-destructive",
              tonnesDelta === 0 && "text-muted-foreground",
            )}
          >
            {fixtureDeltaLabel(t, tonnesDelta, formatTonnes(Math.abs(tonnesDelta)))}
          </p>
        ) : null}
        <p className="mt-2 mb-3 text-xs text-muted-foreground">{t("tonnage.legend")}</p>
        <TonnageBarChart categories={tonnageCategories} series={tonnageBars} />
      </ProfileSection>
    </div>
  )
}
