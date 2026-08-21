import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { toMixPercentRows, type MixSeries } from "./profileChartData"

export type { MixSeries, MixPercentRow } from "./profileChartData"

const mixChartConfig = {
  programme: { label: "Programme", color: "hsl(174 100% 39%)" },
  quickWorkout: { label: "Quick Workout", color: "hsl(220 14% 55%)" },
  circuits: { label: "Circuits", color: "hsl(262 52% 58%)" },
} satisfies ChartConfig

const MIX_STACKS = ["programme", "quickWorkout", "circuits"] as const

export function MixStackedChart({
  categories,
  series,
}: {
  categories: readonly string[]
  series: MixSeries
}) {
  const data = toMixPercentRows(categories, series)

  return (
    <ChartContainer
      config={mixChartConfig}
      className="aspect-video w-full"
      role="img"
      aria-label="Mix"
    >
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="category"
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {MIX_STACKS.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="mix"
            fill={`var(--color-${key})`}
            radius={i === MIX_STACKS.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
