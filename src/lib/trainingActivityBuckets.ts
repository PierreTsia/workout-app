import type { TrainingDayBucketRow, TrainingDayDense } from "@/types/history"

function parseDay(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number)
  return { y, m, d }
}

function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

/** Advance one calendar day (UTC date parts — range uses logical dates only). */
function nextDay(y: number, m: number, d: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }
}

function compareDay(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
): number {
  if (a.y !== b.y) return a.y - b.y
  if (a.m !== b.m) return a.m - b.m
  return a.d - b.d
}

/**
 * Build a dense array [p_from, p_to] inclusive with 0-filled gaps.
 * `sparse` rows use `day` as YYYY-MM-DD (from RPC).
 */
export function buildDenseTrainingDays(
  sparse: TrainingDayBucketRow[],
  pFrom: string,
  pTo: string,
): TrainingDayDense[] {
  const map = new Map<string, { session_count: number; minutes: number }>()
  for (const row of sparse) {
    map.set(row.day, {
      session_count: Number(row.session_count),
      minutes: Number(row.minutes),
    })
  }

  let cur = parseDay(pFrom)
  const end = parseDay(pTo)
  const out: TrainingDayDense[] = []
  while (compareDay(cur, end) <= 0) {
    const date = toISODate(cur.y, cur.m, cur.d)
    const hit = map.get(date)
    out.push({
      date,
      session_count: hit?.session_count ?? 0,
      minutes: hit?.minutes ?? 0,
    })
    cur = nextDay(cur.y, cur.m, cur.d)
  }
  return out
}
