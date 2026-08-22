import { Line, LineChart } from "recharts"
import { useTranslation } from "react-i18next"
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatDate, formatSecondsMMSS } from "@/lib/formatters"
import {
  ProfileChartTooltip,
  ProfileChartTooltipLayer,
} from "./ProfileChartTooltip"

export function formatCircuitSparkScore(
  score: number,
  mode: "amrap" | "rounds",
  roundsLabel: (count: number) => string,
): string {
  if (mode === "rounds") return formatSecondsMMSS(score)
  return roundsLabel(score)
}

function sparkPointDay(payload: ReadonlyArray<unknown> | undefined): string | undefined {
  const item = payload?.[0]
  if (item == null || typeof item !== "object") return undefined
  const row = Object.fromEntries(Object.entries(item))
  const nested = row.payload
  if (nested == null || typeof nested !== "object") return undefined
  const point = Object.fromEntries(Object.entries(nested))
  return typeof point.day === "string" && point.day !== "" ? point.day : undefined
}

function shortSparkDay(day: string, locale: string): string {
  const parts = day.split("-").map(Number)
  const year = parts[0]
  const month = parts[1]
  const date = parts[2]
  if (year == null || month == null || date == null) return day
  return formatDate(new Date(year, month - 1, date), locale, {
    month: "short",
    day: "numeric",
  })
}

export function CircuitScoreSparkline({
  name,
  values,
  mode,
  days,
}: {
  name: string
  values: readonly number[]
  mode: "amrap" | "rounds"
  days?: readonly string[]
}) {
  const { t, i18n } = useTranslation("profile")
  if (values.length < 2) return null

  const scoreLabel = (count: number) => t("circuits.tooltip.amrap", { count })
  const formatted = values.map((value) =>
    formatCircuitSparkScore(value, mode, scoreLabel),
  )
  const data = values.map((value, i) => ({
    i,
    score: value,
    day: days?.[i],
  }))
  const sparkConfig = {
    score: { label: t("circuits.score"), color: "hsl(174 100% 39%)" },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={sparkConfig}
      className="relative z-10 h-8 w-14 overflow-visible [&_.recharts-tooltip-wrapper]:z-20 [&_.recharts-wrapper]:overflow-visible"
      role="img"
      aria-label={`${name} score: ${formatted.join(", ")}`}
    >
      <LineChart
        data={data}
        accessibilityLayer
        margin={{ top: 6, right: 4, bottom: 4, left: 4 }}
      >
        <ProfileChartTooltipLayer
          allowEscapeViewBox={{ x: true, y: true }}
          reverseDirection={{ x: true, y: true }}
          content={(props) => {
            const day = sparkPointDay(props.payload)
            return (
              <ProfileChartTooltip
                active={props.active}
                payload={props.payload}
                label={day == null ? undefined : shortSparkDay(day, i18n.language)}
                formatValue={(value) =>
                  formatCircuitSparkScore(value, mode, scoreLabel)
                }
              />
            )
          }}
        />
        <Line
          dataKey="score"
          type="monotone"
          stroke="var(--color-score)"
          strokeWidth={2}
          isAnimationActive={false}
          dot={{ r: 2.5, strokeWidth: 0 }}
          activeDot={{ r: 3.5 }}
        />
      </LineChart>
    </ChartContainer>
  )
}
