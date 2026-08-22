import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { UserRound } from "lucide-react"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { FeaturedBadgePicker } from "@/components/profile/FeaturedBadgePicker"
import { ProgramBadgePopover } from "@/components/profile/ProgramBadgePopover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useActiveProgram } from "@/hooks/useActiveProgram"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { useFirstFinishedSessionAt } from "@/hooks/useFirstFinishedSessionAt"
import { useProfileLiveQueries } from "@/hooks/useProfileSnapshot"
import { useUserProfile } from "@/hooks/useUserProfile"
import { useUserPrograms } from "@/hooks/useUserPrograms"
import { rankColorRing, resolveActiveTitle } from "@/lib/achievementUtils"
import { hopOtherProgramId, hopOtherProgramIdFromIds } from "@/lib/profile/hop"
import {
  localDateFromIsoDay,
  tenureSpan,
  tenureSpanKey,
  tenureStartAt,
} from "@/lib/profile/tenure"
import { PIERRE_SUCCES } from "@/lib/profile/window"
import {
  isoDayInTimeZone,
  profileWindowRange,
} from "@/lib/profile/windowRange"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/userDisplay"
import { cn } from "@/lib/utils"
import { authAtom } from "@/store/atoms"

export type HeroFixtureMode = "pierre" | "empty" | "loading"

const PIERRE_FIRST_SESSION_AT = "2024-03-12"

export function HeroBlock({ mode }: { mode: HeroFixtureMode }) {
  const { t, i18n } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const profileQuery = useUserProfile()
  const profile = profileQuery.data
  const { data: firstFinishedAt } = useFirstFinishedSessionAt()
  const { data: activeProgram } = useActiveProgram()
  const { data: programs } = useUserPrograms()
  const { data: badges } = useBadgeStatus()
  const live = mode === "pierre" && user != null
  const identityPending = live && profileQuery.isPending
  const { snapshotQuery, rollupsQuery, boundedKind, liveBounded, liveAll } =
    useProfileLiveQueries(kind, live)

  if (mode === "loading") {
    return (
      <div className="flex items-center gap-5">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-5 w-56" />
        </div>
      </div>
    )
  }

  const displayName = identityPending
    ? ""
    : live
      ? resolveDisplayName(user, profile)
      : "Pierre"
  const avatarSrc = identityPending
    ? undefined
    : live
      ? resolveAvatarUrl(user, profile)
      : undefined
  const fallback = live ? undefined : "PT"

  const liveStart = live
    ? tenureStartAt(firstFinishedAt ?? null, profile?.created_at ?? null)
    : null
  const start = live
    ? liveStart
    : mode === "pierre"
      ? localDateFromIsoDay(PIERRE_FIRST_SESSION_AT)
      : null
  const span = start != null ? tenureSpan(start, new Date()) : null

  const equipped = live
    ? resolveActiveTitle(profile, badges ?? [])
    : mode === "pierre"
      ? PIERRE_SUCCES.highest
      : null
  const title = equipped
    ? i18n.language === "fr"
      ? equipped.title_fr
      : equipped.title_en
    : null

  const programName = live ? (activeProgram?.name ?? null) : "Upper/Lower"

  const timeZone = getResolvedIANATimeZone()
  const hopId =
    liveBounded && boundedKind != null && snapshotQuery.data != null
      ? hopOtherProgramId(
          snapshotQuery.data.sessions,
          {
            ...profileWindowRange(boundedKind, isoDayInTimeZone(new Date(), timeZone)),
            timeZone,
          },
          activeProgram?.id ?? null,
        )
      : liveAll && rollupsQuery.data != null
        ? hopOtherProgramIdFromIds(
            rollupsQuery.data.program_ids,
            activeProgram?.id ?? null,
          )
        : null
  const hopName = hopId
    ? (programs ?? []).find((program) => program.id === hopId)?.name
    : null
  const showFixtureHop = !live && mode === "pierre" && includeDeltas
  const hopLabel = hopName ?? (showFixtureHop ? "PPL" : null)
  const hopCopy =
    hopLabel != null
      ? t("hero.hop", { other: hopLabel, window: t(`window.${kind}`) })
      : null

  return (
    <section aria-labelledby="profile-hero-name" className="flex items-center gap-5">
      {identityPending ? (
        <Skeleton className="size-20 shrink-0 rounded-full" />
      ) : (
        <Avatar
          className={cn(
            "size-20 ring-2 ring-offset-2 ring-offset-background",
            equipped ? rankColorRing[equipped.rank] : "ring-border",
          )}
        >
          {avatarSrc ? (
            <AvatarImage src={avatarSrc} alt="" referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback>{fallback ?? <UserRound className="size-8 text-muted-foreground" />}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        {identityPending ? (
          <Skeleton id="profile-hero-name" className="h-7 w-36" />
        ) : (
          <p id="profile-hero-name" className="text-2xl font-bold tracking-tight">
            {displayName}
          </p>
        )}
        {title && equipped ? (
          <FeaturedBadgePicker title={title} equipped={equipped} />
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {programName ? (
            live && activeProgram?.id ? (
              <ProgramBadgePopover
                programId={activeProgram.id}
                programName={programName}
                label={t("hero.activeProgram", { program: programName })}
                variant="secondary"
              />
            ) : (
              <Badge variant="secondary">
                {t("hero.activeProgram", { program: programName })}
              </Badge>
            )
          ) : null}
          {hopCopy != null && hopLabel != null ? (
            live && hopId ? (
              <ProgramBadgePopover
                programId={hopId}
                programName={hopName ?? hopLabel}
                label={hopCopy}
                variant="outline"
              />
            ) : (
              <Badge variant="outline">{hopCopy}</Badge>
            )
          ) : null}
        </div>
        {span != null && (live || mode === "pierre") ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("hero.activeSince", {
              span: t(tenureSpanKey(span), { count: span.n }),
            })}
          </p>
        ) : null}
      </div>
    </section>
  )
}
