import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { readRhythmHits, rhythmLesson } from "./chartLessons"
import { ProfileChartTooltip } from "./ProfileChartTooltip"
import { profileTickInterval } from "./profileChartData"

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
  const yMax = Math.max(target, ...series)
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
          interval={profileTickInterval(categories.length)}
          minTickGap={16}
        />
        <YAxis hide domain={[0, yMax]} allowDecimals={false} />
        <ReferenceLine y={target} stroke="hsl(174 100% 39% / 0.55)" strokeDasharray="4 4" />
        <ChartTooltip
          content={(props) => (
            <ProfileChartTooltip
              active={props.active}
              payload={props.payload}
              label={props.label}
              lesson={rhythmLesson(
                readRhythmHits(props.payload?.[0]?.payload),
                target,
                t,
              )}
              formatValue={(value) => t("rhythm.tooltip.days", { n: value })}
            />
          )}
        />
        <Bar dataKey="hits" fill="var(--color-hits)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
