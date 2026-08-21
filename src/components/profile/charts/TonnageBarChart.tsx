import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const tonnageChartConfig = {
  tonnage: { label: "Tonnage", color: "hsl(174 100% 39%)" },
} satisfies ChartConfig

function toTonnageRows(
  categories: readonly string[],
  series: readonly number[],
): { category: string; tonnage: number }[] {
  return categories.map((category, i) => ({
    category,
    tonnage: series[i] ?? 0,
  }))
}

export function TonnageBarChart({
  categories,
  series,
}: {
  categories: readonly string[]
  series: readonly number[]
}) {
  const data = toTonnageRows(categories, series)

  return (
    <ChartContainer
      config={tonnageChartConfig}
      className="aspect-video w-full"
      role="img"
      aria-label="Tonnage"
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
        <Bar dataKey="tonnage" fill="var(--color-tonnage)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
