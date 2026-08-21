import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { radarLesson, readRadarRow } from "./chartLessons"
import { ProfileChartTooltip } from "./ProfileChartTooltip"
import {
  PIERRE_SET_CREDIT_SCALE,
  toRadarRows,
  type MuscleRadarSeries,
} from "./profileChartData"

export type {
  MuscleRadarSeries,
  MuscleRadarValues,
  MuscleRadarRow,
} from "./profileChartData"

const radarChartConfig = {
  current: { label: "Current", color: "hsl(174 100% 39%)" },
  prior: { label: "Prior", color: "hsl(240 10% 55%)" },
} satisfies ChartConfig

export function MuscleRadarChart({ series }: { series: MuscleRadarSeries }) {
  const { t } = useTranslation("profile")
  const data = toRadarRows(series)
  const hasPrior = series.prior !== undefined

  return (
    <ChartContainer
      config={radarChartConfig}
      className="aspect-square w-full"
      role="img"
      aria-label="Muscle balance"
    >
      <RadarChart data={data} accessibilityLayer>
        <PolarGrid />
        <PolarAngleAxis dataKey="muscle" />
        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
        <ChartTooltip
          content={(props) => (
            <ProfileChartTooltip
              active={props.active}
              payload={props.payload}
              label={readRadarRow(props.payload?.[0]?.payload)?.muscle}
              lesson={radarLesson(readRadarRow(props.payload?.[0]?.payload), t)}
              formatValue={(value) =>
                t("balance.tooltip.sets", {
                  n: Math.round(value * PIERRE_SET_CREDIT_SCALE),
                })
              }
            />
          )}
        />
        {hasPrior ? <ChartLegend content={<ChartLegendContent />} /> : null}
        <Radar
          dataKey="current"
          stroke="var(--color-current)"
          fill="var(--color-current)"
          fillOpacity={0.25}
        />
        {hasPrior ? (
          <Radar
            dataKey="prior"
            stroke="var(--color-prior)"
            fill="none"
            strokeDasharray="4 4"
          />
        ) : null}
      </RadarChart>
    </ChartContainer>
  )
}
