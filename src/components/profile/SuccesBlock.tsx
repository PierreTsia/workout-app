import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { ProfileSection } from "@/components/profile/ProfileSection"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { BadgeDetailDrawer } from "@/components/achievements/BadgeDetailDrawer"
import { BadgeIcon } from "@/components/achievements/BadgeIcon"
import { useBadgeStatus } from "@/hooks/useBadgeStatus"
import { PIERRE_SUCCES } from "@/lib/profile/window"
import {
  buildSuccesVm,
  formatBadgePerformance,
  isSuccesListKind,
  succesListPreview,
  type SuccesListKind,
  type SuccesRankCount,
} from "@/lib/profile/succes"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { rankColorText } from "@/lib/achievementUtils"
import {
  isoDayInTimeZone,
  profileWindowRange,
} from "@/lib/profile/windowRange"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { authAtom } from "@/store/atoms"
import type { BadgeStatusRow } from "@/types/achievements"

export type SuccesFixtureMode = "pierre" | "empty" | "loading"

function blockStatus(
  mode: SuccesFixtureMode,
  pierreStatus: "ok" | "empty",
): "ok" | "empty" | "loading" {
  if (mode === "loading") return "loading"
  if (mode === "empty") return "empty"
  return pierreStatus
}

function badgeTitle(
  spot: { title_en: string; title_fr: string },
  language: string,
): string {
  return language === "fr" ? spot.title_fr : spot.title_en
}

function grantedDateLabel(grantedAt: string | null, language: string): string | null {
  if (grantedAt == null) return null
  return new Date(grantedAt).toLocaleDateString(language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function SuccesPerformance({
  badge,
  className,
}: {
  badge: BadgeStatusRow
  className?: string
}) {
  const { i18n } = useTranslation()
  const label = formatBadgePerformance(badge, i18n.language)
  if (label == null) return null
  return (
    <span className={cn("shrink-0 tabular-nums", className)}>
      {label}
    </span>
  )
}

function SuccesRecentRow({
  badge,
  onSelect,
}: {
  badge: BadgeStatusRow
  onSelect: (badge: BadgeStatusRow) => void
}) {
  const { t } = useTranslation("achievements")
  const { i18n } = useTranslation()
  const title = badgeTitle(badge, i18n.language)
  const date = grantedDateLabel(badge.granted_at, i18n.language)

  return (
    <button
      type="button"
      aria-label={title}
      className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-left [&>*]:min-w-0 transition-transform active:scale-[0.99]"
      onClick={() => onSelect(badge)}
    >
      <BadgeIcon rank={badge.rank} iconUrl={badge.icon_asset_url} size="sm" alt={title} />
      <span className="flex min-w-0 w-full flex-col overflow-hidden">
        <span className="min-w-0 truncate text-sm">{title}</span>
        {date ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">{date}</span>
        ) : null}
        <span className="min-w-0 truncate text-xs leading-snug text-muted-foreground/70">
          {t(`groupDescriptions.${badge.group_slug}`)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <SuccesPerformance
          badge={badge}
          className={cn("text-sm", rankColorText[badge.rank])}
        />
        <Badge
          variant="outline"
          className={cn("shrink-0 capitalize", rankColorText[badge.rank])}
        >
          {t(`ranks.${badge.rank}`)}
        </Badge>
      </span>
    </button>
  )
}

function FeaturedBadge({
  label,
  badge,
  onSelect,
}: {
  label: string
  badge: BadgeStatusRow
  onSelect: (badge: BadgeStatusRow) => void
}) {
  const { t, i18n } = useTranslation("achievements")
  const title = badgeTitle(badge, i18n.language)
  const unlockedDate = grantedDateLabel(badge.granted_at, i18n.language)

  return (
    <button
      type="button"
      aria-label={title}
      className="flex w-full min-w-0 flex-col items-center gap-2 [&>*]:min-w-0 transition-transform active:scale-95"
      onClick={() => onSelect(badge)}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <BadgeIcon
        rank={badge.rank}
        iconUrl={badge.icon_asset_url}
        size="xl"
        alt={title}
      />
      <span className="min-w-0 w-full line-clamp-2 text-center text-sm font-medium leading-tight">
        {title}
      </span>
      <SuccesPerformance
        badge={badge}
        className={cn("text-base font-semibold leading-none", rankColorText[badge.rank])}
      />
      {unlockedDate ? (
        <span className="min-w-0 w-full truncate text-center text-xs text-muted-foreground">
          {t("unlockedOn", { date: unlockedDate })}
        </span>
      ) : null}
      <span className="min-w-0 w-full line-clamp-2 text-center text-xs leading-snug text-muted-foreground/70">
        {t(`groupDescriptions.${badge.group_slug}`)}
      </span>
    </button>
  )
}

function SuccesRankCounts({ counts }: { counts: readonly SuccesRankCount[] }) {
  const { t } = useTranslation("profile")
  const { t: ta } = useTranslation("achievements")

  if (counts.length === 0) return null

  return (
    <ul
      aria-label={t("achievements.byRank")}
      className="flex flex-wrap gap-1.5"
    >
      {counts.map(({ rank, count }) => (
        <li key={rank}>
          <Badge
            variant="outline"
            className={cn("capitalize border-current", rankColorText[rank])}
          >
            {t("achievements.rankCount", {
              rank: ta(`ranks.${rank}`),
              n: count,
            })}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

export function SuccesBlock({ mode }: { mode: SuccesFixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const badgeQuery = useBadgeStatus()
  const [selected, setSelected] = useState<BadgeStatusRow | null>(null)
  const [listKind, setListKind] = useState<SuccesListKind>("recent")
  const live = mode === "pierre" && user != null

  if (mode === "loading" || (live && badgeQuery.isPending)) {
    return (
      <ProfileSection
        title={t("achievements.title")}
        status="loading"
        empty={t("achievements.empty")}
      />
    )
  }

  if (mode === "empty") {
    return (
      <ProfileSection
        title={t("achievements.title")}
        hint={
          <ProfileHint label={t("about", { section: t("achievements.title") })}>
            {t("achievements.hint")}
          </ProfileHint>
        }
        status="empty"
        empty={t("achievements.empty")}
      />
    )
  }

  if (live && badgeQuery.isError) {
    return (
      <ProfileSection
        title={t("achievements.title")}
        status="error"
        empty={t("achievements.empty")}
        error={t("error")}
      />
    )
  }

  const timeZone = getResolvedIANATimeZone()
  const window =
    kind === "all"
      ? null
      : {
          ...profileWindowRange(kind, isoDayInTimeZone(new Date(), timeZone)),
          timeZone,
        }
  const liveVm =
    live && badgeQuery.data != null ? buildSuccesVm(badgeQuery.data, window) : null
  const vm =
    liveVm ??
    (mode === "pierre"
      ? {
          status: "ok" as const,
          unlocked: PIERRE_SUCCES.unlocked,
          total: PIERRE_SUCCES.total,
          latest: PIERRE_SUCCES.latest,
          highest: PIERRE_SUCCES.highest,
          recent: PIERRE_SUCCES.recent,
          nextHighest: PIERRE_SUCCES.nextHighest,
          byRank: PIERRE_SUCCES.byRank,
        }
      : { status: "empty" as const })

  const status = blockStatus(mode, vm.status === "ok" ? "ok" : "empty")
  const listRows =
    vm.status === "ok"
      ? listKind === "recent"
        ? vm.recent
        : vm.nextHighest
      : []
  const listPreview = succesListPreview(listRows)
  const showList = vm.status === "ok" && (vm.recent.length > 0 || vm.nextHighest.length > 0)
  const listLabel =
    listKind === "recent" ? t("achievements.listRecent") : t("achievements.listHighest")

  return (
    <>
      <ProfileSection
        title={t("achievements.title")}
        hint={
          <ProfileHint label={t("about", { section: t("achievements.title") })}>
            {t("achievements.hint")}
          </ProfileHint>
        }
        status={status}
        empty={t("achievements.empty")}
      >
        {vm.status === "ok" ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {t("achievements.count", {
                  n: vm.unlocked,
                  total: vm.total,
                })}
              </p>
              <SuccesRankCounts counts={vm.byRank} />
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3 [&>*]:min-w-0">
              <FeaturedBadge
                label={t("achievements.latest")}
                badge={vm.latest}
                onSelect={setSelected}
              />
              <FeaturedBadge
                label={t("achievements.highest")}
                badge={vm.highest}
                onSelect={setSelected}
              />
            </div>
            {showList ? (
              <div className="flex min-w-0 flex-col gap-2">
                <ToggleGroup
                  type="single"
                  value={listKind}
                  onValueChange={(value) => {
                    if (isSuccesListKind(value)) setListKind(value)
                  }}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  aria-label={t("achievements.listToggle")}
                >
                  <ToggleGroupItem value="recent">
                    {t("achievements.listRecent")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="highest">
                    {t("achievements.listHighest")}
                  </ToggleGroupItem>
                </ToggleGroup>
                {listPreview.shown.length > 0 ? (
                  <ul aria-label={listLabel} className="flex min-w-0 flex-col gap-2">
                    {listPreview.shown.map((spot) => (
                      <li key={spot.tier_id} className="min-w-0">
                        <SuccesRecentRow badge={spot} onSelect={setSelected} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                {listPreview.more > 0 ? (
                  <Link
                    to="/achievements"
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {t("achievements.andMore", { n: listPreview.more })}
                  </Link>
                ) : null}
              </div>
            ) : null}
            <Link
              to="/achievements"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {t("achievements.seeAll")}
            </Link>
          </div>
        ) : null}
      </ProfileSection>
      <BadgeDetailDrawer badge={selected} onClose={() => setSelected(null)} />
    </>
  )
}
