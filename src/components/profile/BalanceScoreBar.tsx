import {
  BALANCE_BAND_COLOR,
  balanceBandFromScore,
} from "@/lib/trainingBalance"

export function BalanceScoreBar({
  score,
  label,
  bandLabel,
}: {
  score: number
  label: string
  bandLabel: string
}) {
  const band = balanceBandFromScore(score)
  const clamped = Math.min(100, Math.max(0, score))

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium tabular-nums">{label}</span>
        <span className="text-xs text-muted-foreground">{bandLabel}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full origin-left rounded-full transition-transform duration-300"
          style={{
            transform: `scaleX(${clamped / 100})`,
            backgroundColor: BALANCE_BAND_COLOR[band],
          }}
        />
      </div>
    </div>
  )
}
