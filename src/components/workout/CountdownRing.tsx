import { formatSeconds } from "@/hooks/useRestTimer"

interface CountdownRingProps {
  /** Seconds left on the clock. */
  remaining: number
  /** Full duration of this countdown, used to fill the ring. */
  total: number
  /** Outer diameter in px. */
  size?: number
  strokeWidth?: number
}

/**
 * A clock-shaped countdown: a depleting circular arc with the remaining time in
 * the center. Mirrors the rest-timer drawer ring so blocks feel consistent (#351).
 */
export function CountdownRing({
  remaining,
  total,
  size = 200,
  strokeWidth = 8,
}: CountdownRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0
  const dashOffset = circumference * (1 - progress)
  const center = size / 2

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
      <span className="absolute text-5xl font-bold tabular-nums">
        {formatSeconds(remaining)}
      </span>
    </div>
  )
}
