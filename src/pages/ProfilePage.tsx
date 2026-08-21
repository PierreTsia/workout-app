import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { BalanceTonnageRow } from "@/components/profile/BalanceTonnageRow"
import { CircuitsBlock } from "@/components/profile/CircuitsBlock"
import { HeroBlock } from "@/components/profile/HeroBlock"
import { MixBlock } from "@/components/profile/MixBlock"
import { PulseBlock } from "@/components/profile/PulseBlock"
import { RecordsBlock } from "@/components/profile/RecordsBlock"
import { RhythmBlock } from "@/components/profile/RhythmBlock"
import { SuccesBlock } from "@/components/profile/SuccesBlock"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { RegularsBlock } from "@/components/profile/RegularsBlock"
import {
  ProfileWindowProvider,
  useProfileWindow,
} from "@/components/profile/ProfileWindowContext"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
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
  const navigate = useNavigate()
  const [kind, setKind] = useState<ProfileWindowKind>("7")
  const [mode, setMode] = useState<FixtureMode>("pierre")

  return (
    <ProfileWindowProvider kind={kind} setKind={setKind}>
    <TooltipProvider delayDuration={200}>
      <div className="flex w-full flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t("back")}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold tracking-tight">{t("nav")}</h1>
            </div>
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
