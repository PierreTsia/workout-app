import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { MixStackedChart } from "@/components/profile/charts/MixStackedChart"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { ProfileSection } from "@/components/profile/ProfileSection"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { useProfileLiveQueries } from "@/hooks/useProfileSnapshot"
import { buildMixVm, buildMixVmFromRollups } from "@/lib/profile/mixSlice"
import {
  emptyMixSeries,
  MIX_CATEGORIES,
  pierreMixSeries,
} from "@/lib/profile/window"
import {
  isoDayInTimeZone,
  profileWindowRange,
} from "@/lib/profile/windowRange"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { authAtom } from "@/store/atoms"

export type MixFixtureMode = "pierre" | "empty" | "loading"

export function MixBlock({ mode }: { mode: MixFixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const { snapshotQuery, rollupsQuery, boundedKind, liveBounded, liveAll } =
    useProfileLiveQueries(kind, mode === "pierre" && user != null)

  const hint = (
    <ProfileHint label={t("about", { section: t("mix.title") })}>
      {t("mix.hint")}
    </ProfileHint>
  )

  if (
    mode === "loading" ||
    (liveBounded && snapshotQuery.isPending) ||
    (liveAll && rollupsQuery.isPending)
  ) {
    return (
      <ProfileSection
        title={t("mix.title")}
        hint={hint}
        status="loading"
        empty={t("mix.empty")}
      />
    )
  }

  if (mode === "empty") {
    return (
      <ProfileSection
        title={t("mix.title")}
        hint={hint}
        status="empty"
        empty={t("mix.empty")}
      />
    )
  }

  if ((liveBounded && snapshotQuery.isError) || (liveAll && rollupsQuery.isError)) {
    return (
      <ProfileSection
        title={t("mix.title")}
        hint={hint}
        status="error"
        empty={t("mix.empty")}
        error={t("error")}
      />
    )
  }

  const timeZone = getResolvedIANATimeZone()
  const liveVm =
    liveBounded && snapshotQuery.data != null && boundedKind != null
      ? buildMixVm(snapshotQuery.data, {
          kind: boundedKind,
          ...profileWindowRange(
            boundedKind,
            isoDayInTimeZone(new Date(), timeZone),
          ),
          timeZone,
        })
      : liveAll && rollupsQuery.data != null
        ? buildMixVmFromRollups(rollupsQuery.data)
        : null

  if (liveVm?.status === "empty") {
    return (
      <ProfileSection
        title={t("mix.title")}
        hint={hint}
        status="empty"
        empty={t("mix.empty")}
      />
    )
  }

  const categories =
    liveVm?.status === "ok" ? liveVm.categories : MIX_CATEGORIES[kind]
  const series =
    liveVm?.status === "ok"
      ? liveVm.series
      : mode === "pierre"
        ? pierreMixSeries(kind)
        : emptyMixSeries(kind)

  return (
    <ProfileSection
      title={t("mix.title")}
      hint={hint}
      status="ok"
      empty={t("mix.empty")}
    >
      <MixStackedChart categories={categories} series={series} />
    </ProfileSection>
  )
}
