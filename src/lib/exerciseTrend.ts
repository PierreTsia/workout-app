import { computeEpley1RM } from "./epley"
import type { SetLog } from "@/types/database"

export type TrendVariant = "e1rm" | "reps" | "duration"

export interface TrendPoint {
  timestamp: number
  value: number
}

export interface TrendSeries {
  scatter: TrendPoint[]
  trend: TrendPoint[]
}

const DEFAULT_WINDOW = 7

export function buildExerciseTrendSeries(
  logs: SetLog[],
  variant: TrendVariant,
  options: { window?: number } = {},
): TrendSeries {
  const windowSize = options.window ?? DEFAULT_WINDOW

  const sorted = logs
    .slice()
    .sort((a, b) => Date.parse(a.logged_at) - Date.parse(b.logged_at))

  const scatter = sorted
    .map((log) => extractTrendPoint(log, variant))
    .filter((point): point is TrendPoint => point !== null)

  const trendValues = rollingMean(
    scatter.map((p) => p.value),
    windowSize,
  )
  const trend = scatter.map<TrendPoint>((p, i) => ({
    timestamp: p.timestamp,
    value: trendValues[i],
  }))

  return { scatter, trend }
}

function extractTrendPoint(log: SetLog, variant: TrendVariant): TrendPoint | null {
  const timestamp = Date.parse(log.logged_at)
  switch (variant) {
    case "e1rm": {
      const value =
        log.estimated_1rm != null
          ? Number(log.estimated_1rm)
          : computeEpley1RM(
              Number(log.weight_logged),
              parseInt(log.reps_logged ?? "0", 10),
            )
      if (!Number.isFinite(value) || value <= 0) return null
      return { timestamp, value }
    }
    case "reps": {
      const reps = parseInt(log.reps_logged ?? "", 10)
      if (!Number.isFinite(reps)) return null
      return { timestamp, value: reps }
    }
    case "duration": {
      if (log.duration_seconds == null) return null
      return { timestamp, value: log.duration_seconds }
    }
  }
}

function rollingMean(values: number[], windowSize: number): number[] {
  const safeWindow = Math.max(1, Math.floor(windowSize))
  return values.map((_, i) => {
    const start = Math.max(0, i + 1 - safeWindow)
    const slice = values.slice(start, i + 1)
    return slice.reduce((sum, v) => sum + v, 0) / slice.length
  })
}
