import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { MixStackedChart } from "@/components/profile/charts/MixStackedChart"
import { MuscleRadarChart } from "@/components/profile/charts/MuscleRadarChart"
import { RecordsComboChart } from "@/components/profile/charts/RecordsComboChart"
import {
  RADAR_CURRENT,
  RADAR_PRIOR,
} from "@/components/profile/charts/fixtures"
import { ProfileSection } from "@/components/profile/ProfileSection"
import {
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
import { BadgeIcon } from "@/components/achievements/BadgeIcon"
import {
  emptyMixSeries,
  MIX_CATEGORIES,
  PIERRE_CIRCUITS,
  PIERRE_REGULARS,
  PIERRE_SUCCES,
  pierreMixSeries,
  pierrePulse,
  pierreRecordsSeries,
  pierreRhythmPresence,
  PROFILE_WINDOW_KINDS,
  type ProfileWindowKind,
} from "@/lib/profile/window"
import type { AchievementRank } from "@/types/achievements"

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

  const streak = mode === "empty" ? 0 : 12

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
        <p className="text-sm">{t("hero.streak", { n: streak })}</p>
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

function FeaturedBadge({
  label,
  rank,
  iconUrl,
  title,
}: {
  label: string
  rank: AchievementRank
  iconUrl: string | null
  title: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <BadgeIcon rank={rank} iconUrl={iconUrl} size="md" alt={title} />
      <span className="max-w-24 truncate text-center text-[11px] font-medium leading-tight">
        {title}
      </span>
    </div>
  )
}

function SuccesBlock({ mode }: { mode: FixtureMode }) {
  const { t, i18n } = useTranslation("profile")
  const status = blockStatus(mode, "ok")
  const latestTitle = badgeTitle(PIERRE_SUCCES.latest, i18n.language)
  const highestTitle = badgeTitle(PIERRE_SUCCES.highest, i18n.language)

  return (
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
            rank={PIERRE_SUCCES.latest.rank}
            iconUrl={PIERRE_SUCCES.latest.icon_asset_url}
            title={latestTitle}
          />
          <FeaturedBadge
            label={t("achievements.highest")}
            rank={PIERRE_SUCCES.highest.rank}
            iconUrl={PIERRE_SUCCES.highest.icon_asset_url}
            title={highestTitle}
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t("achievements.recent")}</p>
          <div className="flex flex-wrap gap-3">
            {PIERRE_SUCCES.recent.map((spot) => {
              const title = badgeTitle(spot, i18n.language)
              return (
                <div key={spot.title_en} className="flex flex-col items-center gap-1">
                  <BadgeIcon
                    rank={spot.rank}
                    iconUrl={spot.icon_asset_url}
                    size="sm"
                    alt={title}
                  />
                  <span className="max-w-16 truncate text-center text-[10px] text-muted-foreground">
                    {title}
                  </span>
                </div>
              )
            })}
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
  )
}

function PulseBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind, includeDeltas } = useProfileWindow()
  const pulse = pierrePulse(kind)

  if (mode === "loading") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ProfileStatCardSkeleton />
        <ProfileStatCardSkeleton />
        <ProfileStatCardSkeleton />
      </div>
    )
  }

  if (mode === "empty") {
    return (
      <ProfileSection title={t("pulse.sessions")} status="empty" empty={t("pulse.empty")} />
    )
  }

  const sessionHint = includeDeltas
    ? t("pulse.delta", { n: pulse.sessionDelta })
    : undefined
  const timeHint = includeDeltas
    ? t("pulse.delta", { n: pulse.timeDeltaN })
    : undefined

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ProfileStatCard
        title={t("pulse.sessions")}
        value={pulse.sessions}
        hint={sessionHint}
      />
      <ProfileStatCard
        title={t("pulse.timeUnderBar")}
        value={pulse.timeUnderBar}
        hint={timeHint}
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
    </div>
  )
}

function RhythmBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { kind } = useProfileWindow()
  const status = mode === "loading" ? "loading" : "ok"
  const presence =
    mode === "pierre" ? pierreRhythmPresence(kind) : MIX_CATEGORIES[kind].map(() => false)

  return (
    <ProfileSection title={t("rhythm.title")} status={status} empty={null}>
      <p className="mb-3 text-sm text-muted-foreground">{t(`rhythm.caption.${kind}`)}</p>
      <ol className="flex flex-wrap gap-2">
        {MIX_CATEGORIES[kind].map((label, i) => {
          const on = presence[i] === true
          return (
            <li
              key={label}
              aria-label={on ? t("rhythm.session") : t("rhythm.none")}
              className={
                on
                  ? "size-7 rounded-full bg-primary"
                  : "size-7 rounded-full border border-border bg-transparent"
              }
            />
          )
        })}
      </ol>
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
  const { includeDeltas } = useProfileWindow()
  const status = blockStatus(mode, "ok")

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
        <p className="mt-2 text-xs text-muted-foreground">{t("tonnage.legend")}</p>
      </ProfileSection>
    </div>
  )
}

function RegularsBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const status = blockStatus(mode, "ok")

  return (
    <ProfileSection
      title={t("regulars.title")}
      status={status}
      empty={t("regulars.empty")}
    >
      <p className="mb-3 text-xs text-muted-foreground">{t("regulars.subtitle")}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {PIERRE_REGULARS.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-2">
            <span>{row.name}</span>
            <Badge variant={row.onProgram ? "secondary" : "outline"}>
              {row.onProgram ? t("regulars.onProgram") : t("regulars.offProgram")}
            </Badge>
          </li>
        ))}
      </ul>
    </ProfileSection>
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

function ProfileFold({ mode }: { mode: FixtureMode }) {
  return (
    <div className="flex flex-col gap-4">
      <HeroBlock mode={mode} />
      <SuccesBlock mode={mode} />
      <PulseBlock mode={mode} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-7">
        <div className="min-w-0 lg:col-span-4">
          <MixBlock mode={mode} />
        </div>
        <div className="min-w-0 lg:col-span-3">
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
