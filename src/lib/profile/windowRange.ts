import type { ProfileWindowKind } from "@/lib/profile/window"

export type SnapshotHorizon = 200 | 730

const WINDOW_DAYS: Record<Exclude<ProfileWindowKind, "all">, number> = {
  "7": 7,
  "30": 30,
  "100": 100,
  "365": 365,
}

export function snapshotHorizon(kind: ProfileWindowKind): SnapshotHorizon | null {
  if (kind === "all") return null
  return kind === "365" ? 730 : 200
}

export function isoDayInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (year == null || month == null || day == null) {
    throw new Error(`Could not format local day in ${timeZone}`)
  }
  return `${year}-${month}-${day}`
}

export function addIsoDays(isoDay: string, days: number): string {
  const [year, month, day] = isoDay.split("-").map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const y = String(utc.getUTCFullYear())
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const d = String(utc.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function inclusiveRangeEndingOn(
  to: string,
  days: number,
): { from: string; to: string } {
  return { from: addIsoDays(to, -(days - 1)), to }
}

export function snapshotPrefetchRange(
  horizon: SnapshotHorizon,
  today: string,
): { from: string; to: string } {
  return inclusiveRangeEndingOn(today, horizon)
}

export function profileWindowRange(
  kind: Exclude<ProfileWindowKind, "all">,
  today: string,
): { from: string; to: string } {
  return inclusiveRangeEndingOn(today, WINDOW_DAYS[kind])
}

export function priorWindowRange(from: string, to: string): { from: string; to: string } {
  const days = isoDayDiff(from, to) + 1
  const priorTo = addIsoDays(from, -1)
  return inclusiveRangeEndingOn(priorTo, days)
}

export function isoDaysInclusive(from: string, to: string): string[] {
  const count = isoDayDiff(from, to) + 1
  if (count <= 0) return []
  return Array.from({ length: count }, (_, i) => addIsoDays(from, i))
}

export function isoDayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  const start = Date.UTC(fy, fm - 1, fd)
  const end = Date.UTC(ty, tm - 1, td)
  return Math.round((end - start) / 86_400_000)
}
