import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ProfileChartTooltip,
  ProfileChartTooltipLayer,
} from "./ProfileChartTooltip"
import {
  localizeProfileTick,
  PROFILE_Y_LEFT,
  PROFILE_Y_RIGHT,
  profileTickInterval,
} from "./profileChartData"

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
  const tick = (value: string | number) => localizeProfileTick(String(value), t)
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
          tickFormatter={tick}
        />
        <YAxis
          domain={[0, yMax]}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={PROFILE_Y_LEFT}
        />
        <YAxis
          orientation="right"
          width={PROFILE_Y_RIGHT}
          tick={false}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine y={target} stroke="hsl(174 100% 39% / 0.55)" strokeDasharray="4 4" />
        <ProfileChartTooltipLayer
          content={(props) => (
            <ProfileChartTooltip
              active={props.active}
              payload={props.payload}
              label={
                props.label == null ? undefined : tick(String(props.label))
              }
              formatValue={(value) => t("rhythm.tooltip.days", { n: value })}
            />
          )}
        />
        <Bar dataKey="hits" fill="var(--color-hits)" />
      </BarChart>
    </ChartContainer>
  )
}
