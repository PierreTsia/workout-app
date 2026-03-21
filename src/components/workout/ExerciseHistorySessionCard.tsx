import { useTranslation } from "react-i18next"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import { rirBadgeClassName } from "@/lib/rirStyles"
import type { ExerciseHistorySessionRow } from "@/lib/exerciseHistorySheet"
import { useWeightUnit } from "@/hooks/useWeightUnit"

interface ExerciseHistorySessionCardProps {
  session: ExerciseHistorySessionRow
  equipment?: string
}

export function ExerciseHistorySessionCard({
  session,
  equipment,
}: ExerciseHistorySessionCardProps) {
  const { t, i18n } = useTranslation("workout")
  const { unit, formatWeight } = useWeightUnit()

  const weightLabel =
    equipment === "dumbbell"
      ? t("weightPerArm", { unit })
      : equipment === "bodyweight"
        ? t("addedWeight", { unit })
        : unit

  const relative = formatRelativeTime(session.finished_at, i18n.language)

  return (
    <div className="w-[min(100%,280px)] shrink-0 snap-start rounded-xl border border-border bg-card/80 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{relative}</p>
      <div className="grid grid-cols-[1.25rem_1fr_1fr_2.25rem] gap-x-1 gap-y-1 text-xs">
        <span className="text-center text-muted-foreground">{t("setNumber")}</span>
        <span className="text-muted-foreground">{t("reps")}</span>
        <span
          className={
            equipment === "dumbbell" || equipment === "bodyweight" ? "" : "capitalize"
          }
        >
          {weightLabel}
        </span>
        <span className="text-center text-muted-foreground">RIR</span>
        {session.sets.map((set) => (
          <div key={set.id} className="contents">
            <span className="text-center tabular-nums text-muted-foreground">
              {set.set_number}
            </span>
            <span className="tabular-nums">{set.reps_logged}</span>
            <span className="tabular-nums">{formatWeight(set.weight_logged)}</span>
            <div className="flex items-center justify-center">
              <span
                className={rirBadgeClassName(set.rir)}
                title={set.rir === null ? undefined : `RIR ${set.rir}`}
              >
                {set.rir === null || set.rir === undefined ? "—" : set.rir}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
