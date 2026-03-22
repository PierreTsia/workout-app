import { useTranslation } from "react-i18next"
import { HeatmapCalendar, type HeatmapCell } from "@/components/history/heatmap-calendar"
import { heatmapLevelFromTrainingMinutes } from "@/lib/heatmapLevelFromTrainingMinutes"
import { weekStartsOnForLanguage } from "@/lib/weekStartsOnForLanguage"
import type { TrainingDayDense } from "@/types/history"

type HeatmapDayMeta = { session_count: number }

/** Inline palette — avoids Tailwind `bg-primary/opacity`, which reads flat on dark cards. */
const TRAINING_HEATMAP_PALETTE = [
  "var(--heatmap-0)",
  "var(--heatmap-1)",
  "var(--heatmap-2)",
  "var(--heatmap-3)",
  "var(--heatmap-4)",
  "var(--heatmap-5)",
  "var(--heatmap-6)",
] as const

export function TrainingHeatmap({
  denseRange,
  endDate,
  rangeDays = 100,
  onCellClick,
}: {
  denseRange: TrainingDayDense[]
  endDate?: Date
  rangeDays?: number
  onCellClick?: (cell: HeatmapCell) => void
}) {
  const { t, i18n } = useTranslation("history")
  const weekStartsOn = weekStartsOnForLanguage(i18n.language)

  const data = denseRange.map((d) => ({
    date: d.date,
    value: d.minutes,
    meta: { session_count: d.session_count } satisfies HeatmapDayMeta,
  }))

  return (
    <HeatmapCalendar
      className="border-border/60 shadow-none"
      title={t("activityHeatmap")}
      data={data}
      rangeDays={rangeDays}
      endDate={endDate ?? new Date()}
      weekStartsOn={weekStartsOn}
      palette={[...TRAINING_HEATMAP_PALETTE]}
      getLevelForValue={heatmapLevelFromTrainingMinutes}
      cellSize={12}
      cellGap={3}
      onCellClick={onCellClick}
      legend={{
        lessText: t("heatmapLess"),
        moreText: t("heatmapMore"),
      }}
      renderTooltip={(cell) => {
        if (cell.disabled) return t("heatmapOutsideRange")
        const meta = cell.meta as HeatmapDayMeta | undefined
        const sessions = meta?.session_count ?? 0
        const minutes = cell.value
        return (
          <div className="text-sm">
            <div className="font-medium">
              {t("heatmapTooltipMinutes", { minutes })}
            </div>
            {sessions > 0 ? (
              <div className="text-muted-foreground">
                {t("heatmapSession", { count: sessions })}
              </div>
            ) : null}
            <div className="text-muted-foreground">{cell.label}</div>
          </div>
        )
      }}
    />
  )
}
