import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { mixLesson, readMixRow } from "./chartLessons"
import { ProfileChartTooltip } from "./ProfileChartTooltip"
import { profileTickInterval, toMixCountRows, type MixSeries } from "./profileChartData"

export type { MixSeries, MixCountRow } from "./profileChartData"

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
  const { t } = useTranslation("profile")
  const data = toMixCountRows(categories, series)

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
          interval={profileTickInterval(categories.length)}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={24}
        />
        <ChartTooltip
          content={(props) => (
            <ProfileChartTooltip
              active={props.active}
              payload={props.payload}
              label={props.label}
              lesson={mixLesson(readMixRow(props.payload?.[0]?.payload), t)}
              formatValue={(value) => String(value)}
              hideZeros
            />
          )}
        />
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
