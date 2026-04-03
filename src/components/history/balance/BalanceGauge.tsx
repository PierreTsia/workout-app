import type { BalanceBand } from "@/lib/trainingBalance"
import { cn } from "@/lib/utils"

const BAND_STROKE: Record<BalanceBand, string> = {
  excellent: "stroke-emerald-500",
  good: "stroke-lime-500",
  attention: "stroke-amber-500",
  imbalanced: "stroke-destructive",
}

interface BalanceGaugeProps {
  score: number
  band: BalanceBand
  bandLabel: string
  deltaPct: number | null
  deltaLabel: string | null
  className?: string
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  score: number,
): string {
  const clamped = Math.min(100, Math.max(0, score))
  const startAngle = Math.PI
  const endAngle = Math.PI * (1 - clamped / 100)
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy - r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy - r * Math.sin(endAngle)
  const largeArc = clamped > 50 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

export function BalanceGauge({
  score,
  band,
  bandLabel,
  deltaPct,
  deltaLabel,
  className,
}: BalanceGaugeProps) {
  const cx = 100
  const cy = 100
  const r = 80

  const gaugeLabel = `${score} ${bandLabel}`

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <svg
        viewBox="0 0 200 112"
        className="w-full max-w-[220px]"
        role="img"
        aria-label={gaugeLabel}
      >
        <path
          d={describeArc(cx, cy, r, 100)}
          fill="none"
          className="stroke-muted"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <path
          d={describeArc(cx, cy, r, score)}
          fill="none"
          className={cn(BAND_STROKE[band])}
          strokeWidth={12}
          strokeLinecap="round"
        />
      </svg>
      <div className="-mt-14 flex flex-col items-center gap-1 text-center">
        <span className="text-4xl font-bold tabular-nums">{score}</span>
        <span className="text-xs font-medium text-muted-foreground">
          {bandLabel}
        </span>
        {deltaPct !== null && deltaLabel ? (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              deltaPct > 0 && "text-emerald-600 dark:text-emerald-400",
              deltaPct < 0 && "text-destructive",
              deltaPct === 0 && "text-muted-foreground",
            )}
          >
            {deltaLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}
