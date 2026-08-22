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
  type ChartConfig,
} from "@/components/ui/chart"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { readRadarRow } from "./chartLessons"
import {
  ProfileChartTooltip,
  ProfileChartTooltipLayer,
} from "./ProfileChartTooltip"
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
  const radarChartConfig = {
    current: { label: t("balance.current"), color: "hsl(174 100% 39%)" },
    prior: { label: t("balance.prior"), color: "hsl(240 10% 55%)" },
  } satisfies ChartConfig

  return (
    <div className="min-w-0">
      <ChartContainer
        config={radarChartConfig}
        className="aspect-square w-full overflow-visible"
        role="img"
        aria-label="Muscle balance"
      >
        <RadarChart
          data={data}
          accessibilityLayer
          cx="50%"
          cy="50%"
          outerRadius="62%"
          margin={{ top: 16, right: 28, bottom: 16, left: 16 }}
        >
          <PolarGrid />
          <PolarAngleAxis
            dataKey="muscle"
            tick={{ fontSize: 9 }}
            tickFormatter={(value) =>
              muscleLabel(typeof value === "string" ? value : undefined)
            }
          />
          <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
          <ProfileChartTooltipLayer
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
                  formatValue={(value, dataKey) =>
                    t("balance.tooltip.sets", {
                      n: Math.round(
                        dataKey === "prior"
                          ? (display?.priorSets ??
                            value * PIERRE_SET_CREDIT_SCALE)
                          : (display?.currentSets ??
                            value * PIERRE_SET_CREDIT_SCALE),
                      ),
                    })
                  }
                />
              )
            }}
          />
          <Radar
            dataKey="current"
            stroke="var(--color-current)"
            fill="var(--color-current)"
            fillOpacity={0.25}
            dot={false}
            activeDot={false}
          />
          {hasPrior ? (
            <Radar
              dataKey="prior"
              stroke="var(--color-prior)"
              fill="none"
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
            />
          ) : null}
        </RadarChart>
      </ChartContainer>
      {hasPrior ? (
        <ul className="mt-1.5 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px] bg-[hsl(174_100%_39%)]"
              aria-hidden
            />
            {t("balance.current")}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px] bg-[hsl(240_10%_55%)]"
              aria-hidden
            />
            {t("balance.prior")}
          </li>
        </ul>
      ) : null}
    </div>
  )
}
