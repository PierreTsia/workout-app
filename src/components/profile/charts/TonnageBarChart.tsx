import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatNumber } from "@/lib/formatters"
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
  const { t, i18n } = useTranslation("profile")
  const data = toTonnageRows(categories, series)
  const tick = (value: string | number) => localizeProfileTick(String(value), t)

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
          interval={profileTickInterval(categories.length)}
          minTickGap={16}
          tickFormatter={tick}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={PROFILE_Y_LEFT}
          tickFormatter={(value) =>
            formatNumber(value, i18n.language, { maximumFractionDigits: 1 })
          }
        />
        <YAxis
          orientation="right"
          width={PROFILE_Y_RIGHT}
          tick={false}
          axisLine={false}
          tickLine={false}
        />
        <ProfileChartTooltipLayer
          content={(props) => (
            <ProfileChartTooltip
              active={props.active}
              payload={props.payload}
              label={
                props.label == null ? undefined : tick(String(props.label))
              }
              formatValue={(value) =>
                `${formatNumber(value, i18n.language, {
                  maximumFractionDigits: 2,
                })} t`
              }
            />
          )}
        />
        <Bar dataKey="tonnage" fill="var(--color-tonnage)" />
      </BarChart>
    </ChartContainer>
  )
}
