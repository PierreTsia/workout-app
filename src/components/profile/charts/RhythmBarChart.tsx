import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

function toRhythmRows(
  categories: readonly string[],
  series: readonly number[],
): { category: string; hits: number }[] {
  return categories.map((category, i) => ({
    category,
    hits: series[i] ?? 0,
  }))
}

export function RhythmBarChart({
  categories,
  series,
  target,
}: {
  categories: readonly string[]
  series: readonly number[]
  target: number
}) {
  const { t } = useTranslation("profile")
  const data = toRhythmRows(categories, series)
  const rhythmChartConfig = {
    hits: { label: t("rhythm.bar"), color: "hsl(174 100% 39%)" },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={rhythmChartConfig}
      className="aspect-[2/1] w-full min-h-[140px]"
      role="img"
      aria-label={t("rhythm.title")}
    >
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="category"
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis hide domain={[0, target]} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="hits" fill="var(--color-hits)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
