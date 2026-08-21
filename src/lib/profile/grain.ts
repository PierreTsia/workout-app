import { getISOWeek, getISOWeekYear } from "date-fns"
import { isoDayInTimeZone, isoDaysInclusive } from "@/lib/profile/windowRange"
import type { ProfileWindowKind } from "@/lib/profile/window"
import type { SessionFact } from "@/lib/profile/types"

export type ProfileGrain = "day" | "isoWeek" | "month"

export type GrainBucket = {
  key: string
  label: string
}

type BoundedKind = Exclude<ProfileWindowKind, "all">

export function grainForKind(kind: BoundedKind): ProfileGrain {
  if (kind === "7") return "day"
  if (kind === "365") return "month"
  return "isoWeek"
}

function utcNoon(isoDay: string): Date {
  const [year, month, day] = isoDay.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function weekdayLabel(isoDay: string): string {
  switch (utcNoon(isoDay).getUTCDay()) {
    case 0:
      return "Sun"
    case 1:
      return "Mon"
    case 2:
      return "Tue"
    case 3:
      return "Wed"
    case 4:
      return "Thu"
    case 5:
      return "Fri"
    case 6:
      return "Sat"
    default:
      return isoDay
  }
}

function monthName(monthIndex: number): string {
  switch (monthIndex) {
    case 0:
      return "Jan"
    case 1:
      return "Feb"
    case 2:
      return "Mar"
    case 3:
      return "Apr"
    case 4:
      return "May"
    case 5:
      return "Jun"
    case 6:
      return "Jul"
    case 7:
      return "Aug"
    case 8:
      return "Sep"
    case 9:
      return "Oct"
    case 10:
      return "Nov"
    case 11:
      return "Dec"
    default:
      return String(monthIndex)
  }
}

function monthLabel(yearMonth: string): string {
  const year = yearMonth.slice(2, 4)
  const monthIndex = Number(yearMonth.slice(5, 7)) - 1
  return `${monthName(monthIndex)} ${year}`
}

function isoWeekKey(isoDay: string): string {
  const date = utcNoon(isoDay)
  const week = String(getISOWeek(date)).padStart(2, "0")
  return `${getISOWeekYear(date)}-W${week}`
}

function weekOffsetLabel(offset: number): string {
  return offset === 0 ? "W" : `W-${offset}`
}

export function grainKey(isoDay: string, grain: ProfileGrain): string {
  if (grain === "day") return isoDay
  if (grain === "month") return isoDay.slice(0, 7)
  return isoWeekKey(isoDay)
}

export function profileBuckets(
  kind: BoundedKind,
  from: string,
  to: string,
): GrainBucket[] {
  const grain = grainForKind(kind)
  const days = isoDaysInclusive(from, to)
  if (grain === "day") {
    return days.map((day) => ({ key: day, label: weekdayLabel(day) }))
  }
  if (grain === "month") {
    const keys = [...new Set(days.map((day) => grainKey(day, "month")))]
    return keys.map((key) => ({ key, label: monthLabel(key) }))
  }
  const keys = [...new Set(days.map((day) => grainKey(day, "isoWeek")))]
  return keys.map((key, i) => ({
    key,
    label: weekOffsetLabel(keys.length - 1 - i),
  }))
}

export function localFinishedDay(session: SessionFact, timeZone: string): string {
  return isoDayInTimeZone(new Date(session.finished_at), timeZone)
}

export function sessionsInRange(
  sessions: readonly SessionFact[],
  from: string,
  to: string,
  timeZone: string,
): SessionFact[] {
  return sessions.filter((session) => {
    const day = localFinishedDay(session, timeZone)
    return day >= from && day <= to
  })
}
