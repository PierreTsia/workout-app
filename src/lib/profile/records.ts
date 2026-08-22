import { grainKey } from "@/lib/profile/grain"
import { prPairs } from "@/lib/profile/prPairs"
import { rir0Rate } from "@/lib/profile/rir0"
import type { ProfileSnapshot, SessionFact, SetFact } from "@/lib/profile/types"
import type { ProfileWindowKind } from "@/lib/profile/window"
import {
  addIsoDays,
  isoDayInTimeZone,
  priorWindowRange,
} from "@/lib/profile/windowRange"

export type RecordsGrain = "day" | "isoWeek" | "month"

export type RecordsVm =
  | { status: "empty" }
  | {
      status: "ok"
      prs: number
      prsDelta: number | null
      exercises: number
      exercisesDelta: number | null
      daysSinceLast: number
      daysSinceLastDelta: number | null
      categories: readonly string[]
      series: {
        prs: readonly number[]
        rir0: readonly (number | null)[]
      }
    }

export function recordsGrain(
  kind: Exclude<ProfileWindowKind, "all">,
): RecordsGrain {
  if (kind === "7") return "day"
  if (kind === "365") return "month"
  return "isoWeek"
}

function isoDayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  )
}

function eachIsoDay(from: string, to: string): string[] {
  const n = isoDayDiff(from, to) + 1
  return Array.from({ length: n }, (_, i) => addIsoDays(from, i))
}

function bucketKey(day: string, grain: RecordsGrain): string {
  return grainKey(day, grain)
}

function distinctExercises(pairs: readonly { exerciseId: string }[]): number {
  return new Set(pairs.map((pair) => pair.exerciseId)).size
}

function lastDay(pairs: readonly { day: string }[]): string {
  return pairs.reduce(
    (latest, pair) => (pair.day > latest ? pair.day : latest),
    pairs[0]?.day ?? "",
  )
}

function groupSetsByBucket(
  snapshot: ProfileSnapshot,
  input: { from: string; to: string; timeZone: string; grain: RecordsGrain },
  sessionsById: Map<string, SessionFact>,
): Map<string, SetFact[]> {
  return snapshot.sets.reduce((acc, set) => {
    const session = sessionsById.get(set.session_id)
    if (session == null) return acc
    const day = isoDayInTimeZone(new Date(session.finished_at), input.timeZone)
    if (day < input.from || day > input.to) return acc
    const key = bucketKey(day, input.grain)
    return acc.set(key, [...(acc.get(key) ?? []), set])
  }, new Map<string, SetFact[]>())
}

export function buildRecordsVm(
  snapshot: ProfileSnapshot,
  input: {
    from: string
    to: string
    includeDeltas: boolean
    timeZone: string
    grain: RecordsGrain
  },
): RecordsVm {
  const pairs = prPairs(snapshot, input)
  if (pairs.length === 0) return { status: "empty" }

  const sessionsById = new Map(
    snapshot.sessions.map((session) => [session.id, session]),
  )
  const keys = [
    ...new Set(eachIsoDay(input.from, input.to).map((day) => bucketKey(day, input.grain))),
  ]
  const setsByBucket = groupSetsByBucket(snapshot, input, sessionsById)
  const prsByBucket = pairs.reduce((acc, pair) => {
    const key = bucketKey(pair.day, input.grain)
    return acc.set(key, (acc.get(key) ?? 0) + 1)
  }, new Map<string, number>())

  const prsSeries = keys.map((key) => prsByBucket.get(key) ?? 0)
  const rirSeries = keys.map((key) => rir0Rate(setsByBucket.get(key) ?? []))
  const declaredBuckets = rirSeries.filter((rate) => rate != null).length
  const rir0 = declaredBuckets < 2 ? keys.map(() => null) : rirSeries

  const exercises = distinctExercises(pairs)
  const daysSinceLast = isoDayDiff(lastDay(pairs), input.to)

  if (!input.includeDeltas) {
    return {
      status: "ok",
      prs: pairs.length,
      prsDelta: null,
      exercises,
      exercisesDelta: null,
      daysSinceLast,
      daysSinceLastDelta: null,
      categories: keys,
      series: { prs: prsSeries, rir0 },
    }
  }

  const prior = priorWindowRange(input.from, input.to)
  const priorPairs = prPairs(snapshot, { ...prior, timeZone: input.timeZone })
  const daysSinceLastDelta =
    priorPairs.length === 0
      ? null
      : isoDayDiff(lastDay(priorPairs), prior.to) - daysSinceLast

  return {
    status: "ok",
    prs: pairs.length,
    prsDelta: pairs.length - priorPairs.length,
    exercises,
    exercisesDelta: exercises - distinctExercises(priorPairs),
    daysSinceLast,
    daysSinceLastDelta,
    categories: keys,
    series: { prs: prsSeries, rir0 },
  }
}
