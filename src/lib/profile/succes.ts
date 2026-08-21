import { isoDayInTimeZone } from "@/lib/profile/windowRange"
import type { AchievementRank, BadgeStatusRow } from "@/types/achievements"

const RANK_ORDER: Record<AchievementRank, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
}

export type SuccesWindow = {
  from: string
  to: string
  timeZone: string
}

export type SuccesVm =
  | { status: "empty" }
  | {
      status: "ok"
      unlocked: number
      total: number
      latest: BadgeStatusRow
      highest: BadgeStatusRow
      recent: BadgeStatusRow[]
    }

function isGranted(
  row: BadgeStatusRow,
): row is BadgeStatusRow & { granted_at: string } {
  return row.is_unlocked && row.granted_at != null
}

function grantedDay(row: BadgeStatusRow & { granted_at: string }, timeZone: string): string {
  return isoDayInTimeZone(new Date(row.granted_at), timeZone)
}

function laterGrant(
  a: BadgeStatusRow & { granted_at: string },
  b: BadgeStatusRow & { granted_at: string },
): BadgeStatusRow & { granted_at: string } {
  return a.granted_at >= b.granted_at ? a : b
}

function higherRank(a: BadgeStatusRow, b: BadgeStatusRow): BadgeStatusRow {
  const rankDelta = RANK_ORDER[a.rank] - RANK_ORDER[b.rank]
  if (rankDelta !== 0) return rankDelta > 0 ? a : b
  return a.tier_level >= b.tier_level ? a : b
}

export function buildSuccesVm(
  rows: readonly BadgeStatusRow[],
  window: SuccesWindow | null,
): SuccesVm {
  const granted = rows.filter(isGranted)
  const latest = granted[0]
  if (latest == null) {
    return { status: "empty" }
  }

  const recent =
    window == null
      ? granted
      : granted.filter((row) => {
          const day = grantedDay(row, window.timeZone)
          return day >= window.from && day <= window.to
        })

  return {
    status: "ok",
    unlocked: granted.length,
    total: rows.length,
    latest: granted.reduce(laterGrant, latest),
    highest: granted.reduce(higherRank, latest),
    recent: [...recent].sort((a, b) => (a.granted_at < b.granted_at ? 1 : -1)),
  }
}
