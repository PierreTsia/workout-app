import { formatCompactNumber, formatNumber } from "@/lib/formatters"
import { isoDayInTimeZone } from "@/lib/profile/windowRange"
import type { AchievementRank, BadgeStatusRow } from "@/types/achievements"

const RANKS = ["bronze", "silver", "gold", "platinum", "diamond"] as const

const RANK_ORDER: Record<AchievementRank, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
}

export type SuccesRankCount = {
  rank: AchievementRank
  count: number
}

export function succesRankCounts(
  granted: readonly { rank: AchievementRank }[],
): SuccesRankCount[] {
  return RANKS.map((rank) => ({
    rank,
    count: granted.filter((row) => row.rank === rank).length,
  })).filter((row) => row.count > 0)
}

export const SUCCES_RECENT_PREVIEW = 3

export function succesListPreview(rows: readonly BadgeStatusRow[]): {
  shown: BadgeStatusRow[]
  more: number
} {
  return {
    shown: rows.slice(0, SUCCES_RECENT_PREVIEW),
    more: Math.max(0, rows.length - SUCCES_RECENT_PREVIEW),
  }
}

export const SUCCES_LIST_KINDS = ["recent", "highest"] as const
export type SuccesListKind = (typeof SUCCES_LIST_KINDS)[number]

export function isSuccesListKind(value: string): value is SuccesListKind {
  return SUCCES_LIST_KINDS.some((kind) => kind === value)
}

const KG_PER_TONNE = 1_000
const KG_PER_KILOTONNE = 1_000_000

function formatScaled(value: number, locale: string): string {
  return formatNumber(value, locale, { maximumFractionDigits: 1 })
}

/**
 * Volume thresholds live in kg on the snapshot (`total_volume_kg`).
 * Compact to metric tonnes — a mass, not a display-unit conversion — so a
 * 320px row never paints `1 000 000 kg`. lb users still see `t`/`kt`;
 * converting first would make bronze (1000 kg → ~2 205 lbs) *longer*.
 */
function formatVolumeKg(kg: number, locale: string): string {
  if (kg >= KG_PER_KILOTONNE) {
    return `${formatScaled(kg / KG_PER_KILOTONNE, locale)} kt`
  }
  if (kg >= KG_PER_TONNE) {
    return `${formatScaled(kg / KG_PER_TONNE, locale)} t`
  }
  return `${formatNumber(kg, locale)} kg`
}

/** Longest compact label `formatBadgePerformance` may paint (e.g. `12,5 kt`). */
export const PERFORMANCE_MAX_CHARS = 10

/**
 * The feat attached to a badge is the tier threshold (kg, reps, runs, …).
 * Locked rows — if shown — use the same number as the unlock target.
 * Volume is stored in kg; other tracks are counts (compact at 10k+).
 */
export function formatBadgePerformance(
  badge: Pick<BadgeStatusRow, "group_slug" | "threshold_value">,
  locale: string,
): string | null {
  const n = Math.floor(badge.threshold_value)
  if (!Number.isFinite(n)) return null
  return badge.group_slug === "volume_king"
    ? formatVolumeKg(n, locale)
    : formatCompactNumber(n, locale)
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
      nextHighest: BadgeStatusRow[]
      byRank: SuccesRankCount[]
    }

function isGranted(
  row: BadgeStatusRow,
): row is BadgeStatusRow & { granted_at: string } {
  return row.is_unlocked && row.granted_at != null
}

function grantedDay(row: BadgeStatusRow & { granted_at: string }, timeZone: string): string {
  return isoDayInTimeZone(new Date(row.granted_at), timeZone)
}

function grantedMs(row: { granted_at: string }): number {
  const ms = Date.parse(row.granted_at)
  return Number.isFinite(ms) ? ms : 0
}

/** Newest instant first. Equal stamps keep later payload order (catalog). */
function byGrantedAtDesc(
  a: { row: BadgeStatusRow & { granted_at: string }; index: number },
  b: { row: BadgeStatusRow & { granted_at: string }; index: number },
): number {
  const delta = grantedMs(b.row) - grantedMs(a.row)
  return delta !== 0 ? delta : b.index - a.index
}

function sortGrantedDesc(
  rows: readonly (BadgeStatusRow & { granted_at: string })[],
): (BadgeStatusRow & { granted_at: string })[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(byGrantedAtDesc)
    .map(({ row }) => row)
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
  const granted = sortGrantedDesc(rows.filter(isGranted))
  const latest = granted[0]
  if (latest == null) {
    return { status: "empty" }
  }

  const inWindow =
    window == null
      ? granted
      : granted.filter((row) => {
          const day = grantedDay(row, window.timeZone)
          return day >= window.from && day <= window.to
        })
  const recent = inWindow.filter((row) => row.tier_id !== latest.tier_id)
  const highest = granted.reduce(higherRank, latest)
  const nextHighest = [...granted]
    .filter((row) => row.tier_id !== highest.tier_id)
    .sort((a, b) => {
      const rankDelta = RANK_ORDER[b.rank] - RANK_ORDER[a.rank]
      if (rankDelta !== 0) return rankDelta
      const tierDelta = b.tier_level - a.tier_level
      if (tierDelta !== 0) return tierDelta
      return grantedMs(b) - grantedMs(a)
    })

  return {
    status: "ok",
    unlocked: granted.length,
    total: rows.length,
    latest,
    highest,
    recent,
    nextHighest,
    byRank: succesRankCounts(granted),
  }
}
