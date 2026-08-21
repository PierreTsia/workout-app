export type TenureSpan =
  | { kind: "days"; n: number }
  | { kind: "months"; n: number }
  | { kind: "years"; n: number; half: boolean }

const MS_PER_DAY = 86_400_000
const DAYS_AS_DAYS = 60
const MONTHS_AS_MONTHS = 18

export function localDateFromIsoDay(isoDay: string): Date {
  const [year, month, day] = isoDay.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function calendarDays(from: Date, now: Date): number {
  return Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(from).getTime()) /
      MS_PER_DAY,
  )
}

function calendarMonths(from: Date, now: Date): number {
  const months =
    (now.getFullYear() - from.getFullYear()) * 12 +
    (now.getMonth() - from.getMonth())
  return now.getDate() < from.getDate() ? months - 1 : months
}

/** Compact tenure: days (<60), months (<18m), else years rounded to the nearest half. */
export function tenureSpan(from: Date, now: Date): TenureSpan {
  const days = Math.max(0, calendarDays(from, now))
  if (days < DAYS_AS_DAYS) {
    return { kind: "days", n: days }
  }

  const months = Math.max(0, calendarMonths(from, now))
  if (months < MONTHS_AS_MONTHS) {
    return { kind: "months", n: months }
  }

  const halfYears = Math.round(months / 6)
  const n = Math.floor(halfYears / 2)
  const half = halfYears % 2 === 1
  return { kind: "years", n, half }
}

/** Career tenure origin: first finished session, else profile created_at. */
export function tenureStartAt(
  firstFinishedStartedAt: string | null,
  profileCreatedAt: string | null,
): Date | null {
  const iso = firstFinishedStartedAt ?? profileCreatedAt
  if (iso == null || iso === "") return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function tenureSpanKey(
  span: TenureSpan,
): "hero.tenureDays" | "hero.tenureMonths" | "hero.tenureYears" | "hero.tenureYearsHalf" {
  if (span.kind === "days") return "hero.tenureDays"
  if (span.kind === "months") return "hero.tenureMonths"
  return span.half ? "hero.tenureYearsHalf" : "hero.tenureYears"
}
