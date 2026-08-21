import { useTranslation } from "react-i18next"
import { HeatmapCalendar } from "@/components/history/heatmap-calendar"
import { weekStartsOnForLanguage } from "@/lib/weekStartsOnForLanguage"
import {
  heatmapLevelFromRhythmValue,
  isRhythmHeatMeta,
  type RhythmHeatDatum,
} from "@/lib/profile/rhythmHeatmap"

const RHYTHM_PALETTE = [
  "var(--heatmap-0)",
  "var(--heatmap-2)",
  "var(--heatmap-5)",
] as const

export function RhythmHeatmap({
  data,
  rangeDays,
  endDate,
  target,
}: {
  data: readonly RhythmHeatDatum[]
  rangeDays: number
  endDate: Date
  target: number
}) {
  const { t, i18n } = useTranslation("profile")

  return (
    <HeatmapCalendar
      framed={false}
      className="border-0 shadow-none"
      data={[...data]}
      rangeDays={rangeDays}
      endDate={endDate}
      weekStartsOn={weekStartsOnForLanguage(i18n.language)}
      palette={[...RHYTHM_PALETTE]}
      getLevelForValue={heatmapLevelFromRhythmValue}
      cellSize={12}
      cellGap={3}
      legend={{
        placement: "bottom",
        lessText: t("rhythm.heatmapRest"),
        moreText: t("rhythm.heatmapGoal"),
      }}
      renderTooltip={(cell) => {
        if (cell.disabled) return t("rhythm.none")
        const meta = isRhythmHeatMeta(cell.meta) ? cell.meta : undefined
        const weekDays = meta?.weekDays ?? 0
        const goalHit = meta?.goalHit ?? false
        return (
          <div className="text-sm">
            <div className="font-medium">
              {goalHit
                ? t("rhythm.heatmapTooltipGoal", { n: weekDays })
                : t("rhythm.heatmapTooltipShort", { n: weekDays, target })}
            </div>
            <div className="text-muted-foreground">{cell.label}</div>
          </div>
        )
      }}
    />
  )
}
