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
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
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

function displayRadarRow(
  payload: unknown,
  labelOf: (muscle: string) => string,
) {
  const row = readRadarRow(payload)
  return row == null ? undefined : { ...row, muscle: labelOf(row.muscle) }
}

export function MuscleRadarChart({ series }: { series: MuscleRadarSeries }) {
  const { t } = useTranslation("profile")
  const { muscleLabel } = useCatalogLabels()
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
        <PolarAngleAxis
          dataKey="muscle"
          tickFormatter={(value) =>
            muscleLabel(typeof value === "string" ? value : undefined)
          }
        />
        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
        <ChartTooltip
          content={(props) => {
            const display = displayRadarRow(
              props.payload?.[0]?.payload,
              muscleLabel,
            )
            return (
              <ProfileChartTooltip
                active={props.active}
                payload={props.payload}
                label={display?.muscle}
                lesson={radarLesson(display, t)}
                formatValue={(value) =>
                  t("balance.tooltip.sets", {
                    n: Math.round(value * PIERRE_SET_CREDIT_SCALE),
                  })
                }
              />
            )
          }}
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
