import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { RecordsComboChart } from "@/components/profile/charts/RecordsComboChart"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { ProfileSection } from "@/components/profile/ProfileSection"
import {
  ProfilePulseGrid,
  ProfileStatCard,
} from "@/components/profile/ProfileStatCard"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { useProfileLiveQueries } from "@/hooks/useProfileSnapshot"
import { buildRecordsVmFromRollups } from "@/lib/profile/allTimeRollups"
import { buildRecordsVm, recordsGrain } from "@/lib/profile/records"
import {
  MIX_CATEGORIES,
  pierreRecordsPulse,
  pierreRecordsSeries,
} from "@/lib/profile/window"
import {
  isoDayInTimeZone,
  profileWindowRange,
} from "@/lib/profile/windowRange"
import { vsPriorDelta } from "@/lib/profile/vsPrior"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { authAtom } from "@/store/atoms"

export type RecordsFixtureMode = "pierre" | "empty" | "loading"

export function RecordsBlock({ mode }: { mode: RecordsFixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const { snapshotQuery, rollupsQuery, boundedKind, liveBounded, liveAll } =
    useProfileLiveQueries(kind, mode === "pierre" && user != null)
  const hint = (
    <ProfileHint label={t("about", { section: t("records.title") })}>
      {t("records.hint")}
    </ProfileHint>
  )

  if (
    mode === "loading" ||
    (liveBounded && snapshotQuery.isPending) ||
    (liveAll && rollupsQuery.isPending)
  ) {
    return (
      <ProfileSection
        title={t("records.title")}
        hint={hint}
        status="loading"
        empty={t("records.empty")}
      />
    )
  }

  if (mode === "empty") {
    return (
      <ProfileSection
        title={t("records.title")}
        hint={hint}
        status="empty"
        empty={t("records.empty")}
      />
    )
  }

  if ((liveBounded && snapshotQuery.isError) || (liveAll && rollupsQuery.isError)) {
    return (
      <ProfileSection
        title={t("records.title")}
        hint={hint}
        status="error"
        empty={t("records.empty")}
        error={t("error")}
      />
    )
  }

  const timeZone = getResolvedIANATimeZone()
  const liveVm =
    liveBounded && snapshotQuery.data != null && boundedKind != null
      ? buildRecordsVm(snapshotQuery.data, {
          ...profileWindowRange(boundedKind, isoDayInTimeZone(new Date(), timeZone)),
          includeDeltas,
          timeZone,
          grain: recordsGrain(boundedKind),
        })
      : liveAll && rollupsQuery.data != null
        ? buildRecordsVmFromRollups(
            rollupsQuery.data,
            isoDayInTimeZone(new Date(), timeZone),
          )
        : null

  if (liveVm?.status === "empty") {
    return (
      <ProfileSection
        title={t("records.title")}
        hint={hint}
        status="empty"
        empty={t("records.empty")}
      />
    )
  }

  const fixturePulse = pierreRecordsPulse(kind)
  const fixtureSeries = pierreRecordsSeries(kind)
  const pulse =
    liveVm?.status === "ok"
      ? {
          prs: liveVm.prs,
          prsDelta: liveVm.prsDelta,
          exercises: liveVm.exercises,
          exercisesDelta: liveVm.exercisesDelta,
          sinceLast: `${liveVm.daysSinceLast}d`,
          sinceDelta: liveVm.daysSinceLastDelta,
          sinceDeltaN:
            liveVm.daysSinceLastDelta == null
              ? ""
              : `${Math.abs(liveVm.daysSinceLastDelta)}d`,
        }
      : fixturePulse
  const categories =
    liveVm?.status === "ok" ? liveVm.categories : MIX_CATEGORIES[kind]
  const series = liveVm?.status === "ok" ? liveVm.series : fixtureSeries

  const vsFreshness = (n: string, value: number) => ({
    value,
    label:
      value === 0
        ? t("pulse.deltaEven")
        : value < 0
          ? t("records.deltaLater", { n })
          : t("records.deltaSooner", { n }),
  })

  return (
    <ProfileSection
      title={t("records.title")}
      hint={hint}
      status="ok"
      empty={t("records.empty")}
    >
      <ProfilePulseGrid>
        <ProfileStatCard
          title={t("records.prs")}
          value={pulse.prs}
          delta={
            includeDeltas && pulse.prsDelta != null
              ? vsPriorDelta(t, pulse.prsDelta)
              : undefined
          }
        />
        <ProfileStatCard
          title={t("records.exercises")}
          value={pulse.exercises}
          delta={
            includeDeltas && pulse.exercisesDelta != null
              ? vsPriorDelta(t, pulse.exercisesDelta)
              : undefined
          }
        />
        <ProfileStatCard
          title={t("records.sinceLast")}
          value={pulse.sinceLast}
          delta={
            includeDeltas && pulse.sinceDelta != null
              ? vsFreshness(pulse.sinceDeltaN, pulse.sinceDelta)
              : undefined
          }
        />
      </ProfilePulseGrid>
      <div className="mt-4">
        <RecordsComboChart categories={categories} series={series} />
      </div>
    </ProfileSection>
  )
}
