import {
  grainForKind,
  grainKey as profileGrainKey,
  profileBuckets,
} from "@/lib/profile/grain"
import {
  isoDayInTimeZone,
  priorWindowRange,
} from "@/lib/profile/windowRange"
import { pierreRhythmPresence, type ProfileWindowKind } from "./window"
import type { ProfileSnapshot, SessionFact, SetFact } from "./types"

export type TonnageVm =
  | { status: "empty" }
  | {
      status: "ok"
      tonnes: number
      deltaTonnes: number | null
      categories: readonly string[]
      bars: number[]
    }

function numericReps(reps: string | null): number | null {
  if (reps == null) return null
  const trimmed = reps.trim()
  if (trimmed === "") return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function loadedSetKg(set: SetFact): number {
  if (set.weight_logged <= 0) return 0
  if (set.duration_seconds != null) return 0
  const reps = numericReps(set.reps)
  if (reps == null) return 0
  return set.weight_logged * reps
}

function localFinishedDay(session: SessionFact, timeZone: string): string {
  return isoDayInTimeZone(new Date(session.finished_at), timeZone)
}

function sessionsInRange(
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

function tonnesInRange(
  snapshot: ProfileSnapshot,
  from: string,
  to: string,
  timeZone: string,
): number {
  const ids = new Set(
    sessionsInRange(snapshot.sessions, from, to, timeZone).map((session) => session.id),
  )
  const kg = snapshot.sets
    .filter((set) => ids.has(set.session_id))
    .reduce((sum, set) => sum + loadedSetKg(set), 0)
  return kg / 1000
}

function slotKey(isoDay: string, kind: ProfileWindowKind): string {
  if (kind === "all") return isoDay.slice(0, 4)
  return profileGrainKey(isoDay, grainForKind(kind))
}

function tonnesBySessionDay(
  snapshot: ProfileSnapshot,
  sessions: readonly SessionFact[],
  timeZone: string,
): Map<string, number> {
  const dayBySession = new Map(
    sessions.map((session) => [session.id, localFinishedDay(session, timeZone)] as const),
  )
  return snapshot.sets.reduce((byDay, set) => {
    const day = dayBySession.get(set.session_id)
    if (day == null) return byDay
    const next = (byDay.get(day) ?? 0) + loadedSetKg(set) / 1000
    byDay.set(day, next)
    return byDay
  }, new Map<string, number>())
}

function tonnageBars(
  snapshot: ProfileSnapshot,
  sessions: readonly SessionFact[],
  kind: ProfileWindowKind,
  from: string,
  to: string,
  timeZone: string,
): { categories: string[]; bars: number[] } {
  const slots =
    kind === "all"
      ? [
          ...new Set(
            sessions.map((session) =>
              slotKey(localFinishedDay(session, timeZone), kind),
            ),
          ),
        ].sort()
      : profileBuckets(kind, from, to).map((bucket) => bucket.key)
  const byDay = tonnesBySessionDay(snapshot, sessions, timeZone)
  const tonnesBySlot = [...byDay.entries()].reduce((bySlot, [day, tonnes]) => {
    const key = slotKey(day, kind)
    bySlot.set(key, (bySlot.get(key) ?? 0) + tonnes)
    return bySlot
  }, new Map<string, number>())
  return {
    categories: slots,
    bars: slots.map((key) => tonnesBySlot.get(key) ?? 0),
  }
}

export function buildTonnageVm(
  snapshot: ProfileSnapshot,
  input: {
    kind: ProfileWindowKind
    from: string
    to: string
    includeDeltas: boolean
    timeZone: string
  },
): TonnageVm {
  const currentSessions = sessionsInRange(
    snapshot.sessions,
    input.from,
    input.to,
    input.timeZone,
  )
  const tonnes = tonnesInRange(snapshot, input.from, input.to, input.timeZone)
  if (tonnes <= 0) return { status: "empty" }

  const { categories, bars } = tonnageBars(
    snapshot,
    currentSessions,
    input.kind,
    input.from,
    input.to,
    input.timeZone,
  )
  const prior = priorWindowRange(input.from, input.to)
  const deltaTonnes = input.includeDeltas
    ? tonnes - tonnesInRange(snapshot, prior.from, prior.to, input.timeZone)
    : null

  return { status: "ok", tonnes, deltaTonnes, categories, bars }
}

export function formatTonnes(tonnes: number): string {
  return `${Number.parseFloat(Math.abs(tonnes).toFixed(2))} t`
}

const SESSION_TONNES = [3.2, 3.8, 2.1, 4.5, 4] as const
const CIRCUIT_STATION_TONNES = 0.8
const TONNAGE_SCALE: Record<ProfileWindowKind, number> = {
  "7": 1,
  "30": 5,
  "100": 8,
  "365": 12,
  all: 40,
}

function loadedTonnesForSession(filledIndex: number): number {
  if (filledIndex % 4 === 3) return CIRCUIT_STATION_TONNES
  const loadedIndex = filledIndex - Math.floor(filledIndex / 4)
  return SESSION_TONNES[loadedIndex % SESSION_TONNES.length] ?? 0
}

/** Loaded-set kg×reps in tonnes. Circuit days keep a small loaded station; rest = 0. */
export function pierreTonnageBars(kind: ProfileWindowKind): number[] {
  const presence = pierreRhythmPresence(kind)
  const filled = presence
    .map((on, i) => ({ on, i }))
    .filter(({ on }) => on)
  const tonnesByIdx = new Map(
    filled.map(({ i }, j) => [i, loadedTonnesForSession(j) * TONNAGE_SCALE[kind]] as const),
  )
  return presence.map((_, i) => tonnesByIdx.get(i) ?? 0)
}
