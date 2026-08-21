import type { ProfileWindowKind } from "./window"

export const RHYTHM_HEAT_REST = 0
export const RHYTHM_HEAT_SHORT = 1
export const RHYTHM_HEAT_GOAL = 2

/** Frozen T0 "today" — same day as tenure tests. */
export const PROFILE_RHYTHM_END = new Date(2026, 7, 21)

export type RhythmSessionDay = {
  date: string
  sessions: number
}

export type RhythmHeatMeta = {
  weekDays: number
  goalHit: boolean
}

export type RhythmHeatDatum = {
  date: string
  value: number
  meta: RhythmHeatMeta
}

export function rhythmHeatmapRangeDays(kind: ProfileWindowKind): number | null {
  if (kind === "100") return 100
  if (kind === "365" || kind === "all") return 365
  return null
}

function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function toDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(date: Date, n: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + n)
  return next
}

function mondayStamp(date: Date): number {
  const monday = new Date(date)
  monday.setHours(0, 0, 0, 0)
  const sinceMonday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - sinceMonday)
  return monday.getTime()
}

export function encodeRhythmGoalDays(
  days: readonly RhythmSessionDay[],
  target: number,
): RhythmHeatDatum[] {
  const weekDays = days
    .filter((day) => day.sessions > 0)
    .map((day) => mondayStamp(parseDay(day.date)))
    .reduce<Record<number, number>>(
      (acc, stamp) => ({ ...acc, [stamp]: (acc[stamp] ?? 0) + 1 }),
      {},
    )

  return days.map((day) => {
    const trained = weekDays[mondayStamp(parseDay(day.date))] ?? 0
    const goalHit = trained >= target
    const value =
      day.sessions <= 0
        ? RHYTHM_HEAT_REST
        : goalHit
          ? RHYTHM_HEAT_GOAL
          : RHYTHM_HEAT_SHORT
    return {
      date: day.date,
      value,
      meta: { weekDays: trained, goalHit },
    }
  })
}

function sessionsForPattern(date: Date): number {
  const weekday = (date.getDay() + 6) % 7
  if (weekday >= 5) return 0
  const pattern = Math.floor(mondayStamp(date) / 86_400_000 / 7) % 7
  if (pattern === 3) return weekday === 0 || weekday === 2 ? 1 : 0
  if (pattern === 6) return weekday <= 4 ? 1 : 0
  return weekday <= 3 ? 1 : 0
}

export function pierreRhythmSessionDays(
  kind: ProfileWindowKind,
  endDate = PROFILE_RHYTHM_END,
): RhythmSessionDay[] {
  const range = rhythmHeatmapRangeDays(kind)
  if (range == null) return []
  const start = addDays(endDate, -(range - 1))
  return Array.from({ length: range }, (_, i) => {
    const date = addDays(start, i)
    return { date: toDayKey(date), sessions: sessionsForPattern(date) }
  })
}

export function heatmapLevelFromRhythmValue(value: number): number {
  if (value <= RHYTHM_HEAT_REST) return 0
  if (value === RHYTHM_HEAT_SHORT) return 1
  return 2
}

export function isRhythmHeatMeta(meta: unknown): meta is RhythmHeatMeta {
  if (typeof meta !== "object" || meta === null) return false
  if (!("weekDays" in meta) || !("goalHit" in meta)) return false
  return typeof meta.weekDays === "number" && typeof meta.goalHit === "boolean"
}
