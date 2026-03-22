import { useTranslation } from "react-i18next"
import { HeatmapCalendar, type HeatmapCell } from "@/components/history/heatmap-calendar"
import type { TrainingDayDense } from "@/types/history"

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
  const { t } = useTranslation("history")

  const data = denseRange.map((d) => ({
    date: d.date,
    value: d.session_count,
    meta: { minutes: d.minutes },
  }))

  return (
    <HeatmapCalendar
      className="border-border/60 shadow-none"
      title={t("activityHeatmap")}
      data={data}
      rangeDays={rangeDays}
      endDate={endDate ?? new Date()}
      weekStartsOn={1}
      cellSize={12}
      cellGap={3}
      onCellClick={onCellClick}
      legend={{
        lessText: t("heatmapLess"),
        moreText: t("heatmapMore"),
      }}
      renderTooltip={(cell) => {
        if (cell.disabled) return t("heatmapOutsideRange")
        const sessions = cell.value
        return (
          <div className="text-sm">
            <div className="font-medium">
              {t("heatmapSession", { count: sessions })}
            </div>
            <div className="text-muted-foreground">{cell.label}</div>
          </div>
        )
      }}
    />
  )
}
