import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { MixStackedChart } from "@/components/profile/charts/MixStackedChart"
import { MuscleRadarChart } from "@/components/profile/charts/MuscleRadarChart"
import { RecordsComboChart } from "@/components/profile/charts/RecordsComboChart"
import { RADAR_CURRENT } from "@/components/profile/charts/fixtures"
import { ProfileSection } from "@/components/profile/ProfileSection"
import {
  ProfileWindowProvider,
  useProfileWindow,
} from "@/components/profile/ProfileWindowContext"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  emptyMixSeries,
  MIX_CATEGORIES,
  pierreMixSeries,
  pierreRhythmPresence,
  PROFILE_WINDOW_KINDS,
  type ProfileWindowKind,
} from "@/lib/profile/window"

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
  const { t } = useTranslation("profile")
  const { includeDeltas } = useProfileWindow()

  if (mode === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    )
  }

  if (mode === "empty") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">Pierre</p>
        <p className="text-sm text-muted-foreground">
          {t("hero.activeProgram", { program: "Upper/Lower" })}
        </p>
        <p className="text-sm">{t("hero.streak", { n: 0 })}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-semibold">Pierre</p>
      <p className="text-sm text-muted-foreground">Castor</p>
      <p className="text-sm text-muted-foreground">
        {t("hero.activeProgram", { program: "Upper/Lower" })}
      </p>
      {includeDeltas ? (
        <p className="text-sm">{t("hero.hop", { other: "PPL" })}</p>
      ) : null}
      <p className="text-sm">{t("hero.streak", { n: 4 })}</p>
    </div>
  )
}

function SuccesBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const status = blockStatus(mode, "ok")

  return (
    <ProfileSection
      title={t("achievements.title")}
      status={status}
      empty={t("achievements.empty")}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t("achievements.count", { n: 12, total: 40 })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("achievements.latest")}</p>
            <p className="font-medium">Castor</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("achievements.highest")}</p>
            <p className="font-medium">Castor</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("achievements.recent")}</p>
          <p className="text-sm">Cindy bronze</p>
        </div>
        <Link to="/achievements" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("achievements.seeAll")}
        </Link>
      </div>
    </ProfileSection>
  )
}

function PulseBlock({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const { includeDeltas } = useProfileWindow()
  const status = blockStatus(mode, "ok")

  return (
    <ProfileSection title={t("pulse.sessions")} status={status} empty={t("pulse.empty")}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("pulse.sessions")}</p>
          <p className="text-lg font-semibold">2</p>
          {includeDeltas ? (
            <p className="text-xs text-muted-foreground">{t("pulse.delta", { n: 1 })}</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("pulse.timeUnderBar")}</p>
          <p className="text-lg font-semibold">1h 12</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("pulse.avgDuration")}</p>
          <p className="text-lg font-semibold">36 min</p>
          <Link to="/account" className="text-xs text-primary underline-offset-4 hover:underline">
            {t("pulse.vsPrescribed", { n: 60 })}
          </Link>
        </div>
      </div>
    </ProfileSection>
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
  const rir0 = categories.map((_, i) => (i === 0 ? 18 : null))

  return (
    <ProfileSection title={t("records.title")} status={status} empty={t("records.empty")}>
      <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("records.prs")}</p>
          <p className="font-semibold">1</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("records.exercises")}</p>
          <p className="font-semibold">1</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("records.sinceLast")}</p>
          <p className="font-semibold">3d</p>
        </div>
      </div>
      <RecordsComboChart
        categories={categories}
        series={{ prs: categories.map((_, i) => (i === 0 ? 1 : 0)), rir0 }}
      />
    </ProfileSection>
  )
}

function BalanceTonnageRow({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const balanceStatus = blockStatus(mode, "empty")
  const tonnageStatus = blockStatus(mode, "empty")

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2 md:items-start">
      <ProfileSection
        title={t("balance.title")}
        status={balanceStatus}
        empty={t("balance.empty")}
      >
        <MuscleRadarChart series={{ current: RADAR_CURRENT }} />
      </ProfileSection>
      <ProfileSection
        title={t("tonnage.title")}
        status={tonnageStatus}
        empty={t("tonnage.empty")}
      >
        <p className="text-2xl font-semibold">2.4 t</p>
        <p className="text-xs text-muted-foreground">{t("tonnage.legend")}</p>
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
      <p className="mb-2 text-xs text-muted-foreground">{t("regulars.subtitle")}</p>
      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex justify-between gap-2">
          <span>Pull-up</span>
          <span className="text-muted-foreground">{t("regulars.onProgram")}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Squat</span>
          <span className="text-muted-foreground">{t("regulars.offProgram")}</span>
        </li>
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
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("circuits.runs")}</p>
          <p className="font-semibold">3</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("circuits.distinct")}</p>
          <p className="font-semibold">1</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("circuits.pbs")}</p>
          <p className="font-semibold">1</p>
        </div>
      </div>
      <p className="mt-3 text-sm">Cindy · AMRAP 20</p>
    </ProfileSection>
  )
}

function ProfileFold({ mode }: { mode: FixtureMode }) {
  return (
    <div className="flex flex-col gap-4">
      <HeroBlock mode={mode} />
      <SuccesBlock mode={mode} />
      <PulseBlock mode={mode} />
      <RhythmBlock mode={mode} />
      <MixBlock mode={mode} />
      <RecordsBlock mode={mode} />
      <BalanceTonnageRow mode={mode} />
      <RegularsBlock mode={mode} />
      <CircuitsBlock mode={mode} />
    </div>
  )
}

export function ProfilePage() {
  const { t } = useTranslation("profile")
  const [kind, setKind] = useState<ProfileWindowKind>("7")
  const [mode, setMode] = useState<FixtureMode>("pierre")

  return (
    <ProfileWindowProvider kind={kind} setKind={setKind}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold">{t("nav")}</h1>
          <WindowToggle />
          <FixtureSwitch mode={mode} onMode={setMode} />
        </div>
        <ProfileFold mode={mode} />
      </div>
    </ProfileWindowProvider>
  )
}
