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
import { buildSuccesVm } from "@/lib/profile/succes"
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

function SuccesMedalButton({
  badge,
  size,
  titleClassName,
  onSelect,
}: {
  badge: BadgeStatusRow
  size: "sm" | "lg"
  titleClassName: string
  onSelect: (badge: BadgeStatusRow) => void
}) {
  const { i18n } = useTranslation()
  const title = badgeTitle(badge, i18n.language)

  return (
    <button
      type="button"
      aria-label={title}
      className={
        size === "lg"
          ? "flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          : "flex flex-col items-center gap-1 transition-transform active:scale-95"
      }
      onClick={() => onSelect(badge)}
    >
      <BadgeIcon rank={badge.rank} iconUrl={badge.icon_asset_url} size={size} alt={title} />
      <span className={titleClassName}>{title}</span>
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
  const unlockedDate = badge.granted_at
    ? new Date(badge.granted_at).toLocaleDateString(i18n.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null

  return (
    <button
      type="button"
      aria-label={title}
      className="flex w-full min-w-0 flex-col items-center gap-2 transition-transform active:scale-95"
      onClick={() => onSelect(badge)}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <BadgeIcon
        rank={badge.rank}
        iconUrl={badge.icon_asset_url}
        size="xl"
        alt={title}
      />
      <span className="text-center text-sm font-medium leading-tight">{title}</span>
      {unlockedDate ? (
        <span className="text-xs text-muted-foreground">
          {t("unlockedOn", { date: unlockedDate })}
        </span>
      ) : null}
      <span className="max-w-48 text-center text-xs leading-snug text-muted-foreground/70">
        {t(`groupDescriptions.${badge.group_slug}`)}
      </span>
    </button>
  )
}

export function SuccesBlock({ mode }: { mode: SuccesFixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const badgeQuery = useBadgeStatus()
  const [selected, setSelected] = useState<BadgeStatusRow | null>(null)
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
        }
      : { status: "empty" as const })

  const status = blockStatus(mode, vm.status === "ok" ? "ok" : "empty")

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
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t("achievements.count", {
                n: vm.unlocked,
                total: vm.total,
              })}
            </p>
            <div className="grid grid-cols-2 gap-3">
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
            {vm.recent.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">{t("achievements.recent")}</p>
                <div className="flex flex-wrap gap-3">
                  {vm.recent.map((spot) => (
                    <SuccesMedalButton
                      key={spot.tier_id}
                      badge={spot}
                      size="sm"
                      titleClassName="max-w-16 truncate text-center text-[10px] text-muted-foreground"
                      onSelect={setSelected}
                    />
                  ))}
                </div>
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
