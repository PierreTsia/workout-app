import { Dumbbell, TrendingUp } from "lucide-react"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { ProfileHint } from "@/components/profile/ProfileHint"
import { ProfileSection } from "@/components/profile/ProfileSection"
import { useProfileWindow } from "@/components/profile/ProfileWindowContext"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"
import { useProfileLiveQueries } from "@/hooks/useProfileSnapshot"
import { regularsFromRollups } from "@/lib/profile/allTimeRollups"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { formatNumber } from "@/lib/formatters"
import {
  pierreRegulars,
  rankRegulars,
  regularsFromSnapshot,
  type RegularEvolution,
} from "@/lib/profile/regulars"
import {
  isoDayInTimeZone,
  profileWindowRange,
} from "@/lib/profile/windowRange"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { cn } from "@/lib/utils"
import { authAtom } from "@/store/atoms"

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
        "inline-flex shrink-0 items-center gap-1 tabular-nums",
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

export function RegularsBlock({ mode }: { mode: RegularsFixtureMode }) {
  const { t, i18n } = useTranslation("profile")
  const { formatWeight } = useWeightUnit()
  const { kind } = useProfileWindow()
  const user = useAtomValue(authAtom)
  const library = useExerciseLibrary()
  const { catalogName } = useCatalogLabels()
  const { snapshotQuery, rollupsQuery, boundedKind, liveBounded, liveAll } =
    useProfileLiveQueries(kind, mode === "pierre" && user != null)
  const timeZone = getResolvedIANATimeZone()
  const windowLabel = t(`window.${kind}`)
  const names = Object.fromEntries(
    (library.data ?? []).map((row) => [row.id, catalogName(row)]),
  )

  const liveRows =
    liveBounded && snapshotQuery.data != null && boundedKind != null
      ? regularsFromSnapshot(snapshotQuery.data, {
          ...profileWindowRange(
            boundedKind,
            isoDayInTimeZone(new Date(), timeZone),
          ),
          timeZone,
          names,
        })
      : liveAll && rollupsQuery.data != null
        ? regularsFromRollups(rollupsQuery.data, names)
        : null

  const status =
    mode === "loading" ||
    (liveBounded && snapshotQuery.isPending) ||
    (liveAll && rollupsQuery.isPending)
      ? "loading"
      : mode === "empty"
        ? "empty"
        : (liveBounded && snapshotQuery.isError) || (liveAll && rollupsQuery.isError)
          ? "error"
          : liveRows != null && liveRows.length === 0
            ? "empty"
            : "ok"

  const rows = liveRows ?? rankRegulars(pierreRegulars(kind))
  const showEvolution = rows.some((row) => row.evolution != null)

  return (
    <ProfileSection
      title={t("regulars.title")}
      hint={
        <ProfileHint label={t("about", { section: t("regulars.title") })}>
          {t("regulars.hint")}
        </ProfileHint>
      }
      status={status}
      empty={t("regulars.empty")}
      error={t("error")}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        {t("regulars.subtitle", { window: windowLabel })}
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.name}
            className={cn(
              "grid items-center gap-2 [&>*]:min-w-0",
              showEvolution
                ? "grid-cols-[minmax(0,1fr)_auto_4.5rem]"
                : "grid-cols-[minmax(0,1fr)_4.5rem]",
            )}
          >
            <span className="min-w-0 truncate" title={row.name}>
              {row.name}
            </span>
            {showEvolution ? (
              row.evolution != null ? (
                <RegularEvolutionMark
                  evolution={row.evolution}
                  formatWeight={formatWeight}
                />
              ) : (
                <span />
              )
            ) : null}
            <span className="shrink-0 text-right tabular-nums text-muted-foreground">
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
