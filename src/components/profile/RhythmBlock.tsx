import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { ProfileSection } from "@/components/profile/ProfileSection"
import { RhythmPresenceChart } from "@/components/profile/RhythmPresenceChart"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { useProfileSnapshot } from "@/hooks/useProfileSnapshot"
import { buildRhythmVm } from "@/lib/profile/rythme"
import { pierreRhythmHits, PIERRE_WEEKLY_TARGET } from "@/lib/profile/window"
import {
  isoDayInTimeZone,
  profileWindowRange,
} from "@/lib/profile/windowRange"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { authAtom } from "@/store/atoms"

export type RhythmFixtureMode = "pierre" | "empty" | "loading"

export function RhythmBlock({ mode }: { mode: RhythmFixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const snapshotQuery = useProfileSnapshot(kind)
  const boundedKind = kind === "all" ? null : kind
  const live = mode === "pierre" && boundedKind != null && user != null
  const target = PIERRE_WEEKLY_TARGET

  const hint = (
    <ProfileHint label={t("about", { section: t("rhythm.title") })}>
      {t("rhythm.hint")}
    </ProfileHint>
  )

  if (mode === "loading" || (live && snapshotQuery.isPending)) {
    return (
      <ProfileSection
        title={t("rhythm.title")}
        hint={hint}
        status="loading"
        empty={t("rhythm.empty")}
      />
    )
  }

  if (mode === "empty") {
    return (
      <ProfileSection
        title={t("rhythm.title")}
        hint={hint}
        status="empty"
        empty={t("rhythm.empty")}
      />
    )
  }

  if (live && snapshotQuery.isError) {
    return (
      <ProfileSection
        title={t("rhythm.title")}
        hint={hint}
        status="error"
        empty={t("rhythm.empty")}
        error={t("error")}
      />
    )
  }

  const timeZone = getResolvedIANATimeZone()
  const liveVm =
    live && snapshotQuery.data != null && boundedKind != null
      ? buildRhythmVm(snapshotQuery.data, {
          kind: boundedKind,
          ...profileWindowRange(
            boundedKind,
            isoDayInTimeZone(new Date(), timeZone),
          ),
          timeZone,
        })
      : null

  const fixture = pierreRhythmHits(kind)
  const hits = liveVm?.hits ?? fixture.hits
  const categories = liveVm?.categories
  const deloadAt = liveVm == null ? fixture.deloadAt : undefined

  return (
    <ProfileSection
      title={t("rhythm.title")}
      hint={hint}
      meta={
        <span className="text-muted-foreground">
          {t("rhythm.meta", {
            window: t(`rhythm.caption.${kind}`),
            target: t("rhythm.target", { n: target }),
          })}
        </span>
      }
      status="ok"
      empty={t("rhythm.empty")}
    >
      <RhythmPresenceChart
        kind={kind}
        hits={hits}
        target={target}
        deloadAt={deloadAt}
        categories={categories}
      />
    </ProfileSection>
  )
}
