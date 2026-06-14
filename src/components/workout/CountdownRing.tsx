import type { ReactNode } from "react"
import { formatSeconds } from "@/hooks/useRestTimer"

interface CountdownRingProps {
  /** Seconds left on the clock. */
  remaining: number
  /** Full duration of this countdown, used to fill the ring. */
  total: number
  /** Outer diameter in px. */
  size?: number
  strokeWidth?: number
  /** Whether the depleting arc is visible. Idle rings show only the track. */
  active?: boolean
  /** Custom center content; defaults to the formatted remaining time. */
  children?: ReactNode
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
  active = true,
  children,
}: CountdownRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0
  const dashOffset = active ? circumference * (1 - progress) : 0
  const center = size / 2

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "scaleX(-1) rotate(-90deg)" }}
      >
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
          strokeOpacity={active ? 1 : 0.3}
          strokeWidth={active ? strokeWidth : strokeWidth - 2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
      <span className="absolute flex items-center justify-center text-5xl font-bold tabular-nums">
        {children ?? formatSeconds(remaining)}
      </span>
    </div>
  )
}
