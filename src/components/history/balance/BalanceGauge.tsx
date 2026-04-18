import { useEffect, useRef, useState } from "react"
import {
  Label,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import type { BalanceBand } from "@/lib/trainingBalance"
import { cn } from "@/lib/utils"

const BAND_COLOR: Record<BalanceBand, string> = {
  excellent: "hsl(142 71% 45%)",
  good: "hsl(84 81% 44%)",
  attention: "hsl(38 92% 50%)",
  imbalanced: "hsl(0 72% 71%)",
}

/** Semicircle filling a 2:1 box. Center on the bottom edge, radius = half width. */
function gaugeLayout(width: number, height: number) {
  const cx = width / 2
  const cy = height
  const outer = Math.max(0, width / 2 - 0.5)
  const inner = outer * 0.76
  const scoreY = cy - inner * 0.48
  const sublabelY = scoreY + 26
  return { cx, cy, outer, inner, scoreY, sublabelY }
}

interface BalanceGaugeRadialProps {
  width?: number
  height?: number
  clamped: number
  bandLabel: string
  chartData: Array<{ score: number; fill: string }>
}

function BalanceGaugeRadialChart({
  width = 0,
  height = 0,
  clamped,
  bandLabel,
  chartData,
}: BalanceGaugeRadialProps) {
  const layout =
    width > 0 && height > 0 ? gaugeLayout(width, height) : null

  if (!layout) {
    return null
  }

  const { cx, cy, outer, inner, scoreY, sublabelY } = layout

  return (
    <RadialBarChart
      width={width}
      height={height}
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      data={chartData}
      startAngle={180}
      endAngle={0}
      cx={cx}
      cy={cy}
      innerRadius={inner}
      outerRadius={outer}
    >
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
      <RadialBar
        dataKey="score"
        background
        cornerRadius={6}
        className="stroke-transparent"
      />
      <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
        <Label
          content={() => (
            <g>
              <text
                x={cx}
                y={scoreY}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground text-4xl font-bold tabular-nums"
              >
                {clamped}
              </text>
              <text
                x={cx}
                y={sublabelY}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-muted-foreground text-xs font-medium"
              >
                {bandLabel}
              </text>
            </g>
          )}
        />
      </PolarRadiusAxis>
    </RadialBarChart>
  )
}

interface BalanceGaugeProps {
  score: number
  band: BalanceBand
  bandLabel: string
  deltaPct: number | null
  deltaLabel: string | null
  className?: string
}

export function BalanceGauge({
  score,
  band,
  bandLabel,
  deltaPct,
  deltaLabel,
  className,
}: BalanceGaugeProps) {
  const clamped = Math.min(100, Math.max(0, score))
  const gaugeLabel = `${score} ${bandLabel}`

  const chartRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((prev) => {
        const w = Math.round(width)
        const h = Math.round(height)
        return prev.width === w && prev.height === h ? prev : { width: w, height: h }
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const chartData = [{ score: clamped, fill: "var(--color-balance)" }]

  const chartConfig = {
    score: { label: "Score" },
    balance: {
      label: bandLabel,
      color: BAND_COLOR[band],
    },
  } satisfies ChartConfig

  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 flex-col items-stretch",
        className,
      )}
      role="img"
      aria-label={gaugeLabel}
    >
      <ChartContainer
        ref={chartRef}
        config={chartConfig}
        className="mx-auto w-full min-w-0 aspect-2/1 [&_.recharts-responsive-container]:h-full [&_.recharts-responsive-container]:min-h-[168px] [&_.recharts-wrapper]:h-full [&_.recharts-wrapper]:w-full"
      >
        <BalanceGaugeRadialChart
          width={size.width}
          height={size.height}
          clamped={clamped}
          bandLabel={bandLabel}
          chartData={chartData}
        />
      </ChartContainer>
      {deltaPct !== null && deltaLabel ? (
        <span
          className={cn(
            "-mt-2 text-center text-xs font-semibold tabular-nums",
            deltaPct > 0 && "text-emerald-600 dark:text-emerald-400",
            deltaPct < 0 && "text-destructive",
            deltaPct === 0 && "text-muted-foreground",
          )}
        >
          {deltaLabel}
        </span>
      ) : null}
    </div>
  )
}
