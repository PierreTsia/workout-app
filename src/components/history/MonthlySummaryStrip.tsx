import { getISOWeek, getISOWeekYear } from "date-fns"
import { useTranslation } from "react-i18next"
import type { TrainingDayDense } from "@/types/history"

function countIsoWeeksTouchingMonth(year: number, monthIndex: number): number {
  const keys = new Set<string>()
  const last = new Date(year, monthIndex + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const dt = new Date(year, monthIndex, d)
    keys.add(`${getISOWeekYear(dt)}-${getISOWeek(dt)}`)
  }
  return keys.size
}

function formatTotalMinutes(total: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (total < 60) return t("summaryMinutesOnly", { count: total })
  const h = Math.floor(total / 60)
  const m = total % 60
  if (m === 0) return t("summaryHoursOnly", { count: h })
  return t("summaryHoursMinutes", { hours: h, minutes: m })
}

function formatAvgMinutes(
  avg: number,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (!Number.isFinite(avg) || avg <= 0) return "—"
  if (avg < 60) return t("summaryMinutesOnly", { count: Math.round(avg) })
  const h = Math.floor(avg / 60)
  const m = Math.round(avg % 60)
  return t("summaryHoursMinutes", { hours: h, minutes: m })
}

export function MonthlySummaryStrip({
  visibleYear,
  visibleMonthIndex,
  denseMonth,
}: {
  visibleYear: number
  visibleMonthIndex: number
  denseMonth: TrainingDayDense[]
}) {
  const { t, i18n } = useTranslation("history")

  const totalSessions = denseMonth.reduce((acc, d) => acc + d.session_count, 0)
  const totalMinutes = denseMonth.reduce((acc, d) => acc + d.minutes, 0)
  const avgDuration =
    totalSessions > 0 ? totalMinutes / totalSessions : Number.NaN

  const W = countIsoWeeksTouchingMonth(visibleYear, visibleMonthIndex)
  const perWeek = W > 0 ? totalSessions / W : Number.NaN

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("monthlyTotalSessions")}
        </p>
        <p className="text-lg font-semibold tabular-nums">{totalSessions}</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("monthlyTotalMinutes")}
        </p>
        <p className="text-lg font-semibold tabular-nums">
          {formatTotalMinutes(totalMinutes, t)}
        </p>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("monthlyAvgDuration")}
        </p>
        <p className="text-lg font-semibold tabular-nums">
          {formatAvgMinutes(avgDuration, t)}
        </p>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("monthlyPerWeek")}
        </p>
        <p className="text-lg font-semibold tabular-nums">
          {W === 0 || !Number.isFinite(perWeek)
            ? "—"
            : perWeek.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}
        </p>
      </div>
    </div>
  )
}
