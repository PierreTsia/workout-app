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
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  PROFILE_WINDOW_SELECT_KINDS,
  isProfileWindowKind,
  type ProfileWindowKind,
} from "@/lib/profile/window"
import {
  resolveProfileWindow,
  writePersistedProfileWindow,
} from "@/lib/profile/persistedWindow"

export type FixtureMode = "pierre" | "empty" | "loading"

function WindowSelect() {
  const { t } = useTranslation("profile")
  const { kind, setKind } = useProfileWindow()

  return (
    <Select
      value={kind}
      onValueChange={(value) => {
        if (isProfileWindowKind(value)) setKind(value)
      }}
    >
      <div className="flex items-center gap-2">
        <SelectTrigger
          aria-label={t("windowToggle")}
          className="h-11 min-w-[12rem] text-base font-semibold shadow-xs sm:min-w-[15rem]"
        >
          <SelectValue />
        </SelectTrigger>
        <ProfileHint label={t("about", { section: t("windowToggle") })}>
          {t("windowHint")}
        </ProfileHint>
      </div>
      <SelectContent>
        {PROFILE_WINDOW_SELECT_KINDS.map((windowKind) => (
          <SelectItem key={windowKind} value={windowKind}>
            {t(`window.${windowKind}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

export function ProfileDashboard({ mode }: { mode: FixtureMode }) {
  const { t } = useTranslation("profile")
  const navigate = useNavigate()
  const [kind, setKind] = useState<ProfileWindowKind>(() =>
    resolveProfileWindow(window.localStorage),
  )

  const persistKind = (next: ProfileWindowKind) => {
    writePersistedProfileWindow(window.localStorage, next)
    setKind(next)
  }

  return (
    <ProfileWindowProvider kind={kind} setKind={persistKind}>
    <TooltipProvider delayDuration={200}>
      <div className="flex w-full flex-col gap-6 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
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
        <ProfileFold mode={mode} />
      </div>
    </TooltipProvider>
    </ProfileWindowProvider>
  )
}

export function ProfilePage() {
  return <ProfileDashboard mode="pierre" />
}
