import type { TrainingDayBucketRow } from "@/types/history"

function parseLocalDayString(iso: string): Date {
  const [yy, mm, dd] = iso.split("-").map(Number)
  return new Date(yy, mm - 1, dd)
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Tech plan (B): last calendar day in `visibleMonth` with ≥1 session;
 * else today when today falls in that month; else first day of month.
 */
export function pickDefaultSelectedDate(
  visibleMonth: Date,
  sparseMonth: TrainingDayBucketRow[],
  today: Date,
): Date {
  const y = visibleMonth.getFullYear()
  const m = visibleMonth.getMonth()
  const inMonth = sparseMonth
    .filter((row) => {
      if (row.session_count <= 0) return false
      const d = parseLocalDayString(row.day)
      return d.getFullYear() === y && d.getMonth() === m
    })
    .sort((a, b) => a.day.localeCompare(b.day))

  if (inMonth.length > 0) {
    return parseLocalDayString(inMonth[inMonth.length - 1].day)
  }

  const tY = today.getFullYear()
  const tM = today.getMonth()
  if (tY === y && tM === m) {
    return startOfLocalDay(today)
  }
  return new Date(y, m, 1)
}
