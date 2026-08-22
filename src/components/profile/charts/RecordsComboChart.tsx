import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ProfileChartTooltip,
  ProfileChartTooltipLayer,
} from "./ProfileChartTooltip"
import {
  formatProfileTooltipLabel,
  localizeProfileTick,
  PROFILE_Y_LEFT,
  PROFILE_Y_RIGHT,
  profileTickInterval,
  toRecordsComboRows,
  type RecordsComboSeries,
} from "./profileChartData"

export type { RecordsComboSeries, RecordsComboRow } from "./profileChartData"

const comboChartConfig = {
  prs: { label: "PRs", color: "hsl(240 10% 55%)" },
  rir0: { label: "RIR 0", color: "hsl(174 100% 39%)" },
} satisfies ChartConfig

export function RecordsComboChart({
  categories,
  series,
}: {
  categories: readonly string[]
  series: RecordsComboSeries
}) {
  const { t, i18n } = useTranslation("profile")
  const data = toRecordsComboRows(categories, series)
  const tick = (value: string | number) => localizeProfileTick(String(value), t)
  const caption = (value: string | number) =>
    formatProfileTooltipLabel(String(value), t, i18n.language)
  const rirPointCount = series.rir0.filter((value) => value != null).length

  return (
    <ChartContainer
      config={comboChartConfig}
      className="aspect-[5/2] w-full min-h-[180px]"
      role="img"
      aria-label="PRs and RIR 0 rate"
    >
      <ComposedChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="category"
          tickLine={false}
          axisLine={false}
          interval={profileTickInterval(categories.length)}
          minTickGap={16}
          tickFormatter={tick}
        />
        <YAxis
          yAxisId="prs"
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={PROFILE_Y_LEFT}
        />
        <YAxis
          yAxisId="rir0"
          orientation="right"
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          width={PROFILE_Y_RIGHT}
          tickFormatter={(value) => `${value}%`}
        />
        <ProfileChartTooltipLayer
          content={(props) => (
            <ProfileChartTooltip
              active={props.active}
              payload={props.payload}
              label={
                props.label == null ? undefined : caption(String(props.label))
              }
              formatValue={(value, dataKey) =>
                dataKey === "rir0" ? `${value}%` : String(value)
              }
            />
          )}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          yAxisId="prs"
          dataKey="prs"
          fill="var(--color-prs)"
          maxBarSize={28}
          activeBar={false}
        />
        {rirPointCount >= 2 ? (
          <Line
            yAxisId="rir0"
            dataKey="rir0"
            type="monotone"
            stroke="var(--color-rir0)"
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3, fill: "var(--color-rir0)", stroke: "transparent" }}
            activeDot={{
              r: 3.5,
              fill: "var(--color-rir0)",
              stroke: "transparent",
            }}
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  )
}
