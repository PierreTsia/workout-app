import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { toRecordsComboRows, type RecordsComboSeries } from "./profileChartData"

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
  const data = toRecordsComboRows(categories, series)

  return (
    <ChartContainer
      config={comboChartConfig}
      className="aspect-video w-full"
      role="img"
      aria-label="PRs and RIR 0 rate"
    >
      <ComposedChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="category"
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          yAxisId="prs"
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={28}
        />
        <YAxis
          yAxisId="rir0"
          orientation="right"
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          width={36}
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          yAxisId="prs"
          dataKey="prs"
          fill="var(--color-prs)"
          maxBarSize={28}
        />
        <Line
          yAxisId="rir0"
          dataKey="rir0"
          type="monotone"
          stroke="var(--color-rir0)"
          strokeWidth={2}
          connectNulls={false}
          dot={{ r: 3, fill: "var(--color-rir0)" }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
