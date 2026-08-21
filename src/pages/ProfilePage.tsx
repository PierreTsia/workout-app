import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { MixStackedChart } from "@/components/profile/charts/MixStackedChart"
import { MuscleRadarChart } from "@/components/profile/charts/MuscleRadarChart"
import { RecordsComboChart } from "@/components/profile/charts/RecordsComboChart"
import { TonnageBarChart } from "@/components/profile/charts/TonnageBarChart"
import {
  RADAR_CURRENT,
  RADAR_PRIOR,
} from "@/components/profile/charts/fixtures"
import { RegularsBlock } from "@/components/profile/RegularsBlock"
import { ProfileSection } from "@/components/profile/ProfileSection"
import { RhythmPresenceChart } from "@/components/profile/RhythmPresenceChart"
import {
  ProfilePulseGrid,
  ProfileStatCard,
  ProfileStatCardSkeleton,
} from "@/components/profile/ProfileStatCard"
import {
  ProfileWindowProvider,
  useProfileWindow,
} from "@/components/profile/ProfileWindowContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BadgeDetailDrawer } from "@/components/achievements/BadgeDetailDrawer"
import { BadgeIcon } from "@/components/achievements/BadgeIcon"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import {
  emptyMixSeries,
  MIX_CATEGORIES,
  PIERRE_CIRCUITS,
  PIERRE_SUCCES,
  pierreMixSeries,
  pierrePulse,
  pierreRecordsSeries,
  pierreRhythmHits,
  PIERRE_WEEKLY_TARGET,
  PROFILE_WINDOW_KINDS,
  type ProfileWindowKind,
} from "@/lib/profile/window"
import { pierreTonnageBars } from "@/lib/profile/tonnage"
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

function WindowToggle() {
  const { t } = useTranslation("profile")
  const { kind, setKind } = useProfileWindow()

  return (
    <ToggleGroup
      type="single"
      value={kind}
      onValueChange={(value) => {
        if (isWindowKind(value)) setKind(value)
      }}
      variant="outline"
      size="sm"
      className="flex flex-wrap justify-start"
      aria-label={t("windowToggle")}
    >
      {PROFILE_WINDOW_KINDS.map((windowKind) => (
        <ToggleGroupItem key={windowKind} value={windowKind} className="px-2.5">
          {t(`window.${windowKind}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    )
  }

  const span = tenureSpan(localDateFromIsoDay(PIERRE_FIRST_SESSION_AT), new Date())

  return (
    <div className="flex items-start gap-4">
      <Avatar className="size-14">
        <AvatarFallback>PT</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xl font-semibold tracking-tight">Pierre</p>
        {mode === "pierre" ? (
          <p className="text-sm text-muted-foreground">
            {i18n.language === "fr"
              ? PIERRE_SUCCES.highest.title_fr
              : PIERRE_SUCCES.highest.title_en}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {t("hero.activeProgram", { program: "Upper/Lower" })}
        </p>
        {mode === "pierre" && includeDeltas ? (
          <p className="text-sm">{t("hero.hop", { other: "PPL" })}</p>
        ) : null}
        {mode === "pierre" ? (
          <p className="text-sm">
            {t("hero.activeSince", {
              span: t(tenureSpanKey(span), { count: span.n }),
            })}
          </p>
        ) : null}
      </div>
    </div>
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

function PulseBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const pulse = pierrePulse(kind)

  if (mode === "loading") {
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
        delta={includeDeltas ? vsPrior(pulse.sessionDelta, pulse.sessionDelta) : undefined}
      />
      <ProfileStatCard
        title={t("pulse.sessionTime")}
        value={pulse.timeUnderBar}
        delta={includeDeltas ? vsPrior(pulse.timeDeltaN, pulse.timeDelta) : undefined}
      />
      <ProfileStatCard
        title={t("pulse.avgDuration")}
        value={`${pulse.avgMinutes} min`}
        hint={
          <Link to="/account" className="text-primary underline-offset-4 hover:underline">
            {t("pulse.vsPrescribed", { n: 60 })}
          </Link>
        }
      />
    </ProfilePulseGrid>
  )
}

function RhythmBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind } = useProfileWindow()
  const status = blockStatus(mode, "ok")
  const target = PIERRE_WEEKLY_TARGET
  const fixture = pierreRhythmHits(kind)

  return (
    <ProfileSection
      title={t("rhythm.title")}
      meta={
        status === "ok"
          ? t("rhythm.meta", {
              window: t(`rhythm.caption.${kind}`),
              target: t("rhythm.target", { n: target }),
            })
          : undefined
      }
      status={status}
      empty={t("rhythm.empty")}
    >
      <RhythmPresenceChart
        kind={kind}
        hits={fixture.hits}
        target={target}
        deloadAt={fixture.deloadAt}
      />
    </ProfileSection>
  )
}

function MixBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind } = useProfileWindow()
  const status = blockStatus(mode, "ok")
  const series = mode === "pierre" ? pierreMixSeries(kind) : emptyMixSeries(kind)

  return (
    <ProfileSection title={t("mix.title")} status={status} empty={t("mix.empty")}>
      <MixStackedChart categories={MIX_CATEGORIES[kind]} series={series} />
    </ProfileSection>
  )
}

function RecordsBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind } = useProfileWindow()
  const status = blockStatus(mode, "ok")
  const categories = MIX_CATEGORIES[kind]
  const series = pierreRecordsSeries(kind)

  return (
    <ProfileSection title={t("records.title")} status={status} empty={t("records.empty")}>
      <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("records.prs")}</p>
          <p className="font-semibold">11</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("records.exercises")}</p>
          <p className="font-semibold">8</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("records.sinceLast")}</p>
          <p className="font-semibold">2d</p>
        </div>
      </div>
      <RecordsComboChart categories={categories} series={series} />
    </ProfileSection>
  )
}

function BalanceTonnageRow({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const status = blockStatus(mode, "ok")
  const bars = pierreTonnageBars(kind)

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
      <ProfileSection
        title={t("balance.title")}
        status={status}
        empty={t("balance.empty")}
      >
        <MuscleRadarChart
          series={{
            current: RADAR_CURRENT,
            prior: includeDeltas ? RADAR_PRIOR : undefined,
          }}
        />
      </ProfileSection>
      <ProfileSection
        title={t("tonnage.title")}
        status={status}
        empty={t("tonnage.empty")}
      >
        <p className="text-3xl font-bold tracking-tight">18.4 t</p>
        {includeDeltas ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("pulse.delta", { n: "1.2 t" })}
          </p>
        ) : null}
        <p className="mt-2 mb-3 text-xs text-muted-foreground">{t("tonnage.legend")}</p>
        <TonnageBarChart categories={MIX_CATEGORIES[kind]} series={bars} />
      </ProfileSection>
    </div>
  )
}

function CircuitsBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const status = blockStatus(mode, "ok")

  return (
    <ProfileSection
      title={t("circuits.title")}
      status={status}
      empty={t("circuits.empty")}
    >
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("circuits.runs")}</p>
          <p className="font-semibold">11</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("circuits.distinct")}</p>
          <p className="font-semibold">2</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("circuits.pbs")}</p>
          <p className="font-semibold">1</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {PIERRE_CIRCUITS.map((row) => (
          <li key={row.name} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{row.name}</span>
              <span className="text-xs text-muted-foreground">{row.mode}</span>
              {row.pb ? <Badge>{t("circuits.pbs")}</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">{row.scores}</p>
          </li>
        ))}
      </ul>
    </ProfileSection>
  )
}

function MixRhythmRow({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const desktop = useMediaQuery("(min-width: 1024px)")

  if (desktop) {
    return (
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 lg:col-span-2">
          <MixBlock mode={mode} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <RhythmBlock mode={mode} />
        </div>
      </div>
    )
  }

  return (
    <Tabs defaultValue="mix" className="min-w-0">
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger value="mix">{t("mix.title")}</TabsTrigger>
        <TabsTrigger value="rhythm">{t("rhythm.title")}</TabsTrigger>
      </TabsList>
      <TabsContent value="mix" className="mt-4">
        <MixBlock mode={mode} />
      </TabsContent>
      <TabsContent value="rhythm" className="mt-4">
        <RhythmBlock mode={mode} />
      </TabsContent>
    </Tabs>
  )
}

function ProfileFold({ mode }: { mode: FixtureMode }) {
  return (
    <div className="flex flex-col gap-4">
      <HeroBlock mode={mode} />
      <SuccesBlock mode={mode} />
      <PulseBlock mode={mode} />
      <MixRhythmRow mode={mode} />
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
      <div className="flex w-full flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight">{t("nav")}</h1>
          <div className="flex flex-col gap-2 sm:items-end">
            <WindowToggle />
            <FixtureSwitch mode={mode} onMode={setMode} />
          </div>
        </div>
        <ProfileFold mode={mode} />
      </div>
    </ProfileWindowProvider>
  )
}
