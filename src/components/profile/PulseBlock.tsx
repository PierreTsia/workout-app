import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { ProfileSection } from "@/components/profile/ProfileSection"
import {
  ProfilePulseGrid,
  ProfileStatCard,
  ProfileStatCardSkeleton,
} from "@/components/profile/ProfileStatCard"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { useProfileLiveQueries } from "@/hooks/useProfileSnapshot"
import { useUserProfile } from "@/hooks/useUserProfile"
import { buildPulseVmFromRollups } from "@/lib/profile/allTimeRollups"
import { buildPulseVm, formatPulseDuration } from "@/lib/profile/pulse"
import { pierrePulse } from "@/lib/profile/window"
import {
  isoDayInTimeZone,
  profileWindowRange,
} from "@/lib/profile/windowRange"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { authAtom } from "@/store/atoms"

export type PulseFixtureMode = "pierre" | "empty" | "loading"

export function PulseBlock({ mode }: { mode: PulseFixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const { data: profile } = useUserProfile()
  const { snapshotQuery, rollupsQuery, boundedKind, liveBounded, liveAll } =
    useProfileLiveQueries(kind, mode === "pierre" && user != null)

  if (
    mode === "loading" ||
    (liveBounded && snapshotQuery.isPending) ||
    (liveAll && rollupsQuery.isPending)
  ) {
    return (
      <ProfilePulseGrid>
        <ProfileStatCardSkeleton />
        <ProfileStatCardSkeleton />
        <ProfileStatCardSkeleton />
      </ProfilePulseGrid>
    )
  }

  if (mode === "empty") {
    return (
      <ProfileSection title={t("pulse.sessions")} status="empty" empty={t("pulse.empty")} />
    )
  }

  if ((liveBounded && snapshotQuery.isError) || (liveAll && rollupsQuery.isError)) {
    return (
      <ProfileSection
        title={t("pulse.sessions")}
        status="error"
        empty={t("pulse.empty")}
        error={t("error")}
      />
    )
  }

  const timeZone = getResolvedIANATimeZone()
  const prescribedMinutes = profile?.session_duration_minutes ?? null
  const liveVm =
    liveBounded && snapshotQuery.data != null && boundedKind != null
      ? buildPulseVm(snapshotQuery.data, {
          ...profileWindowRange(boundedKind, isoDayInTimeZone(new Date(), timeZone)),
          includeDeltas,
          timeZone,
          prescribedMinutes,
        })
      : liveAll && rollupsQuery.data != null
        ? buildPulseVmFromRollups(rollupsQuery.data, prescribedMinutes)
        : null

  if (liveVm?.status === "empty") {
    return (
      <ProfileSection title={t("pulse.sessions")} status="empty" empty={t("pulse.empty")} />
    )
  }

  const fixture = pierrePulse(kind)
  const pulse =
    liveVm?.status === "ok"
      ? {
          sessions: liveVm.sessions,
          sessionDelta: liveVm.sessionDelta,
          timeLabel: formatPulseDuration(liveVm.durationMs),
          timeDeltaN: formatPulseDuration(liveVm.durationDeltaMs ?? 0),
          timeDelta: Math.round((liveVm.durationDeltaMs ?? 0) / 60_000),
          avgMinutes: liveVm.avgMinutes,
          prescribedMinutes: liveVm.prescribedMinutes,
        }
      : {
          sessions: fixture.sessions,
          sessionDelta: fixture.sessionDelta,
          timeLabel: fixture.timeUnderBar,
          timeDeltaN: fixture.timeDeltaN,
          timeDelta: fixture.timeDelta,
          avgMinutes: fixture.avgMinutes,
          prescribedMinutes: 60,
        }

  const vsPrior = (n: string | number, value: number) => ({
    value,
    label:
      value === 0
        ? t("pulse.deltaEven")
        : value < 0
          ? t("pulse.deltaDown", { n })
          : t("pulse.delta", { n }),
  })

  return (
    <ProfilePulseGrid>
      <ProfileStatCard
        title={t("pulse.sessions")}
        value={pulse.sessions}
        delta={
          includeDeltas && pulse.sessionDelta != null
            ? vsPrior(pulse.sessionDelta, pulse.sessionDelta)
            : undefined
        }
      />
      <ProfileStatCard
        title={t("pulse.sessionTime")}
        value={pulse.timeLabel}
        delta={
          includeDeltas && pulse.sessionDelta != null
            ? vsPrior(pulse.timeDeltaN, pulse.timeDelta)
            : undefined
        }
      />
      <ProfileStatCard
        title={t("pulse.avgDuration")}
        value={`${pulse.avgMinutes} min`}
        hint={
          pulse.prescribedMinutes != null ? (
            <Link to="/account" className="text-primary underline-offset-4 hover:underline">
              {t("pulse.vsPrescribed", { n: pulse.prescribedMinutes })}
            </Link>
          ) : undefined
        }
      />
    </ProfilePulseGrid>
  )
}
