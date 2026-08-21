import { Dumbbell, TrendingUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ProfileSection } from "@/components/profile/ProfileSection"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { formatNumber } from "@/lib/formatters"
import {
  PIERRE_REGULARS,
  rankRegulars,
  type RegularEvolution,
} from "@/lib/profile/regulars"
import { cn } from "@/lib/utils"

export type RegularsFixtureMode = "pierre" | "empty" | "loading"

function signedPrefix(n: number): string {
  return n < 0 ? "−" : "+"
}

function RegularEvolutionMark({
  evolution,
  formatWeight,
}: {
  evolution: RegularEvolution
  formatWeight: (kg: number) => string
}) {
  const delta = evolution.kind === "weight" ? evolution.kg : evolution.n
  const Icon = evolution.kind === "weight" ? Dumbbell : TrendingUp
  const label =
    evolution.kind === "weight"
      ? `${signedPrefix(delta)}${formatWeight(Math.abs(delta))}`
      : `${signedPrefix(delta)}${Math.abs(delta)}`

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        delta >= 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  )
}

function blockStatus(mode: RegularsFixtureMode): "ok" | "empty" | "loading" {
  if (mode === "loading") return "loading"
  if (mode === "empty") return "empty"
  return "ok"
}

export function RegularsBlock({ mode }: { mode: RegularsFixtureMode }) {
  const { t, i18n } = useTranslation("profile")
  const { formatWeight } = useWeightUnit()
  const status = blockStatus(mode)
  const rows = rankRegulars(PIERRE_REGULARS)

  return (
    <ProfileSection
      title={t("regulars.title")}
      status={status}
      empty={t("regulars.empty")}
    >
      <p className="mb-3 text-xs text-muted-foreground">{t("regulars.subtitle")}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.name}
            className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-2"
          >
            <span className="truncate">{row.name}</span>
            <RegularEvolutionMark
              evolution={row.evolution}
              formatWeight={formatWeight}
            />
            <span className="text-right tabular-nums text-muted-foreground">
              {row.reps == null
                ? t("regulars.unranked")
                : formatNumber(row.reps, i18n.language)}
            </span>
          </li>
        ))}
      </ul>
    </ProfileSection>
  )
}
