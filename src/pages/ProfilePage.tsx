import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { MuscleRadarChart } from "@/components/profile/charts/MuscleRadarChart"
import { TonnageBarChart } from "@/components/profile/charts/TonnageBarChart"
import { CircuitsBlock } from "@/components/profile/CircuitsBlock"
import { MixBlock } from "@/components/profile/MixBlock"
import { PulseBlock } from "@/components/profile/PulseBlock"
import { RhythmBlock } from "@/components/profile/RhythmBlock"
import { RecordsBlock } from "@/components/profile/RecordsBlock"
import {
  RADAR_CURRENT,
  RADAR_PRIOR,
  radarBalanceScore,
} from "@/components/profile/charts/fixtures"
import { cn } from "@/lib/utils"
import { BalanceScoreBar } from "@/components/profile/BalanceScoreBar"
import { MuscleSetRanks } from "@/components/profile/MuscleSetRanks"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { RegularsBlock } from "@/components/profile/RegularsBlock"
import { ProfileSection } from "@/components/profile/ProfileSection"
import {
  ProfileWindowProvider,
  useProfileWindow,
} from "@/components/profile/ProfileWindowContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BadgeDetailDrawer } from "@/components/achievements/BadgeDetailDrawer"
import { BadgeIcon } from "@/components/achievements/BadgeIcon"
import {
  MIX_CATEGORIES,
  PIERRE_SUCCES,
  PROFILE_WINDOW_KINDS,
  type ProfileWindowKind,
} from "@/lib/profile/window"
import { pierreTonnageBars } from "@/lib/profile/tonnage"
import { rankColorRing, rankColorText } from "@/lib/achievementUtils"
import { balanceBandFromScore } from "@/lib/trainingBalance"
import { localDateFromIsoDay, tenureSpan, tenureSpanKey } from "@/lib/profile/tenure"
import type { BadgeStatusRow } from "@/types/achievements"

export type FixtureMode = "pierre" | "empty" | "loading"

const FIXTURE_MODES: readonly FixtureMode[] = ["pierre", "empty", "loading"]

function isWindowKind(value: string): value is ProfileWindowKind {
  return PROFILE_WINDOW_KINDS.some((kind) => kind === value)
}

function isFixtureMode(value: string): value is FixtureMode {
  return FIXTURE_MODES.some((mode) => mode === value)
}

function blockStatus(
  mode: FixtureMode,
  pierreStatus: "ok" | "empty",
): "ok" | "empty" | "loading" {
  if (mode === "loading") return "loading"
  if (mode === "empty") return "empty"
  return pierreStatus
}

function WindowSelect() {
  const { t } = useTranslation("profile")
  const { kind, setKind } = useProfileWindow()

  return (
    <Select
      value={kind}
      onValueChange={(value) => {
        if (isWindowKind(value)) setKind(value)
      }}
    >
      <div className="flex items-center gap-1.5">
        <SelectTrigger className="w-40" aria-label={t("windowToggle")}>
          <SelectValue />
        </SelectTrigger>
        <ProfileHint label={t("about", { section: t("windowToggle") })}>
          {t("windowHint")}
        </ProfileHint>
      </div>
      <SelectContent>
        {PROFILE_WINDOW_KINDS.map((windowKind) => (
          <SelectItem key={windowKind} value={windowKind}>
            {t(`window.${windowKind}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FixtureSwitch({
  mode,
  onMode,
}: {
  mode: FixtureMode
  onMode: (mode: FixtureMode) => void
}) {
  const { t } = useTranslation("profile")

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={(value) => {
        if (isFixtureMode(value)) onMode(value)
      }}
      variant="outline"
      size="sm"
      className="flex flex-wrap justify-start"
      aria-label={t("fixtures")}
    >
      <ToggleGroupItem value="pierre">{t("fixturePierre")}</ToggleGroupItem>
      <ToggleGroupItem value="empty">{t("fixtureEmpty")}</ToggleGroupItem>
      <ToggleGroupItem value="loading">{t("fixtureLoading")}</ToggleGroupItem>
    </ToggleGroup>
  )
}

/**
 * T0 mock: Pierre's first session (Mix all-time grain starts 2024).
 * T227 should replace this with MIN(sessions.started_at), falling back to
 * profiles.created_at when the user has no sessions.
 */
const PIERRE_FIRST_SESSION_AT = "2024-03-12"

function HeroBlock({ mode }: { mode: FixtureMode }) {
  const { t, i18n } = useTranslation("profile")
  const { includeDeltas } = useProfileWindow()

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

  const span = tenureSpan(localDateFromIsoDay(PIERRE_FIRST_SESSION_AT), new Date())
  const equipped = mode === "pierre" ? PIERRE_SUCCES.highest : null
  const title = equipped
    ? i18n.language === "fr"
      ? equipped.title_fr
      : equipped.title_en
    : null

  return (
    <section aria-labelledby="profile-hero-name" className="flex items-center gap-5">
      <Avatar
        className={cn(
          "size-20 ring-2 ring-offset-2 ring-offset-background",
          equipped ? rankColorRing[equipped.rank] : "ring-border",
        )}
      >
        <AvatarFallback>PT</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p
          id="profile-hero-name"
          className="text-2xl font-bold tracking-tight"
        >
          Pierre
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
          <Badge variant="secondary">
            {t("hero.activeProgram", { program: "Upper/Lower" })}
          </Badge>
          {mode === "pierre" && includeDeltas ? (
            <Badge variant="outline">{t("hero.hop", { other: "PPL" })}</Badge>
          ) : null}
        </div>
        {mode === "pierre" ? (
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

function badgeTitle(spot: {
  title_en: string
  title_fr: string
}, language: string): string {
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

function SuccesBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const [selected, setSelected] = useState<BadgeStatusRow | null>(null)
  const status = blockStatus(mode, "ok")

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
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t("achievements.count", {
              n: PIERRE_SUCCES.unlocked,
              total: PIERRE_SUCCES.total,
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FeaturedBadge
              label={t("achievements.latest")}
              badge={PIERRE_SUCCES.latest}
              onSelect={setSelected}
            />
            <FeaturedBadge
              label={t("achievements.highest")}
              badge={PIERRE_SUCCES.highest}
              onSelect={setSelected}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{t("achievements.recent")}</p>
            <div className="flex flex-wrap gap-3">
              {PIERRE_SUCCES.recent.map((spot) => (
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
          <Link
            to="/achievements"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("achievements.seeAll")}
          </Link>
        </div>
      </ProfileSection>
      <BadgeDetailDrawer badge={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function BalanceTonnageRow({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const status = blockStatus(mode, "ok")
  const bars = pierreTonnageBars(kind)
  const tonnageDelta: number = 1.2
  const score = radarBalanceScore(RADAR_CURRENT)
  const band = balanceBandFromScore(score)
  const priorScore = radarBalanceScore(RADAR_PRIOR)
  const scoreDelta = score - priorScore
  const scoreDeltaLabel =
    scoreDelta === 0
      ? t("pulse.deltaEven")
      : scoreDelta < 0
        ? t("pulse.deltaDown", { n: Math.abs(scoreDelta) })
        : t("pulse.delta", { n: scoreDelta })

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
          status === "ok" && includeDeltas ? (
            <span
              className={cn(
                "font-medium",
                scoreDelta > 0 && "text-emerald-600 dark:text-emerald-400",
                scoreDelta < 0 && "text-destructive",
                scoreDelta === 0 && "text-muted-foreground",
              )}
            >
              {scoreDeltaLabel}
            </span>
          ) : undefined
        }
        status={status}
        empty={t("balance.empty")}
      >
        <BalanceScoreBar
          score={score}
          label={t("balance.score", { score })}
          bandLabel={t(`balance.band.${band}`)}
        />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_10.5rem] items-center gap-3">
          <div className="min-w-0">
            <MuscleRadarChart
              series={{
                current: RADAR_CURRENT,
                prior: includeDeltas ? RADAR_PRIOR : undefined,
              }}
            />
          </div>
          <MuscleSetRanks values={RADAR_CURRENT} />
        </div>
      </ProfileSection>
      <ProfileSection
        title={t("tonnage.title")}
        hint={
          <ProfileHint label={t("about", { section: t("tonnage.title") })}>
            {t("tonnage.hint")}
          </ProfileHint>
        }
        status={status}
        empty={t("tonnage.empty")}
      >
        <p className="text-3xl font-bold tracking-tight">18.4 t</p>
        {includeDeltas ? (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              tonnageDelta > 0 && "text-emerald-600 dark:text-emerald-400",
              tonnageDelta < 0 && "text-destructive",
              tonnageDelta === 0 && "text-muted-foreground",
            )}
          >
            {t("pulse.delta", { n: "1.2 t" })}
          </p>
        ) : null}
        <p className="mt-2 mb-3 text-xs text-muted-foreground">{t("tonnage.legend")}</p>
        <TonnageBarChart categories={MIX_CATEGORIES[kind]} series={bars} />
      </ProfileSection>
    </div>
  )
}

function ProfileFold({ mode }: { mode: FixtureMode }) {
  return (
    <div className="flex flex-col gap-4">
      <HeroBlock mode={mode} />
      <SuccesBlock mode={mode} />
      <PulseBlock mode={mode} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">
          <MixBlock mode={mode} />
        </div>
        <div className="min-w-0">
          <RhythmBlock mode={mode} />
        </div>
      </div>
      <RecordsBlock mode={mode} />
      <BalanceTonnageRow mode={mode} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <RegularsBlock mode={mode} />
        <CircuitsBlock mode={mode} />
      </div>
    </div>
  )
}

export function ProfilePage() {
  const { t } = useTranslation("profile")
  const [kind, setKind] = useState<ProfileWindowKind>("7")
  const [mode, setMode] = useState<FixtureMode>("pierre")

  return (
    <ProfileWindowProvider kind={kind} setKind={setKind}>
    <TooltipProvider delayDuration={200}>
      <div className="flex w-full flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <h1 className="text-2xl font-bold tracking-tight">{t("nav")}</h1>
            <WindowSelect />
          </div>
          <FixtureSwitch mode={mode} onMode={setMode} />
        </div>
        <ProfileFold mode={mode} />
      </div>
    </TooltipProvider>
    </ProfileWindowProvider>
  )
}
