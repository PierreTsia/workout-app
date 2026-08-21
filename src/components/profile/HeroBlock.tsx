import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { UserRound } from "lucide-react"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useActiveProgram } from "@/hooks/useActiveProgram"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { useFirstFinishedSessionAt } from "@/hooks/useFirstFinishedSessionAt"
import { useProfileSnapshot } from "@/hooks/useProfileSnapshot"
import { useUserProfile } from "@/hooks/useUserProfile"
import { useUserPrograms } from "@/hooks/useUserPrograms"
import { rankColorRing, rankColorText, resolveActiveTitle } from "@/lib/achievementUtils"
import { hopOtherProgramId } from "@/lib/profile/hop"
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
  const { data: profile } = useUserProfile()
  const { data: firstFinishedAt } = useFirstFinishedSessionAt()
  const { data: activeProgram } = useActiveProgram()
  const { data: programs } = useUserPrograms()
  const { data: badges } = useBadgeStatus()
  const snapshotQuery = useProfileSnapshot(kind)
  const live = mode === "pierre" && user != null
  const boundedKind = kind === "all" ? null : kind

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

  const displayName = live ? resolveDisplayName(user, profile) : "Pierre"
  const avatarSrc = live ? resolveAvatarUrl(user, profile) : undefined
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
    live && boundedKind != null && snapshotQuery.data != null
      ? hopOtherProgramId(
          snapshotQuery.data.sessions,
          {
            ...profileWindowRange(boundedKind, isoDayInTimeZone(new Date(), timeZone)),
            timeZone,
          },
          activeProgram?.id ?? null,
        )
      : null
  const hopName = hopId
    ? (programs ?? []).find((program) => program.id === hopId)?.name
    : null
  const showFixtureHop = !live && mode === "pierre" && includeDeltas
  const hopLabel = hopName ?? (showFixtureHop ? "PPL" : null)

  return (
    <section aria-labelledby="profile-hero-name" className="flex items-center gap-5">
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
      <div className="min-w-0 flex-1">
        <p id="profile-hero-name" className="text-2xl font-bold tracking-tight">
          {displayName}
        </p>
        {title && equipped ? (
          <p
            className={cn(
              "text-sm font-semibold italic",
              rankColorText[equipped.rank],
            )}
          >
            {title}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {programName ? (
            <Badge variant="secondary">
              {t("hero.activeProgram", { program: programName })}
            </Badge>
          ) : null}
          {hopLabel ? (
            <Badge variant="outline">{t("hero.hop", { other: hopLabel })}</Badge>
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
