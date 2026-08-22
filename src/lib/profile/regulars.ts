import { isoDayInTimeZone } from "@/lib/profile/windowRange"
import type { ProfileSnapshot, SessionFact } from "@/lib/profile/types"
import type { ProfileWindowKind } from "@/lib/profile/window"

export type RegularEvolution =
  | { kind: "weight"; kg: number }
  | { kind: "reps"; n: number }

export type RegularRow = {
  name: string
  evolution?: RegularEvolution
  /** Total numeric reps in the selected window. Null = duration-only. */
  reps: number | null
}

function laterLoggedAt(
  a: { lastLoggedAt?: string },
  b: { lastLoggedAt?: string },
): number {
  if (a.lastLoggedAt == null || b.lastLoggedAt == null) return 0
  if (a.lastLoggedAt === b.lastLoggedAt) return 0
  return a.lastLoggedAt < b.lastLoggedAt ? 1 : -1
}

export function rankRegulars<T extends { reps: number | null; lastLoggedAt?: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (a.reps == null && b.reps == null) return laterLoggedAt(a, b)
    if (a.reps == null) return 1
    if (b.reps == null) return -1
    if (a.reps !== b.reps) return b.reps - a.reps
    return laterLoggedAt(a, b)
  })
}

const REGULARS_MIN_SESSIONS = 2
const REGULARS_LIMIT = 8

function numericReps(reps: string | null): number | null {
  if (reps == null || reps.trim() === "") return null
  const n = Number(reps)
  return Number.isFinite(n) ? n : null
}

function sessionsInRange(
  sessions: readonly SessionFact[],
  from: string,
  to: string,
  timeZone: string,
): SessionFact[] {
  return sessions.filter((session) => {
    const day = isoDayInTimeZone(new Date(session.finished_at), timeZone)
    return day >= from && day <= to
  })
}

function latestFinishedAt(
  sets: readonly { session_id: string }[],
  sessionById: ReadonlyMap<string, SessionFact>,
): string | null {
  const [first, ...rest] = sets.flatMap((set) => {
    const session = sessionById.get(set.session_id)
    return session == null ? [] : [session.finished_at]
  })
  if (first == null) return null
  return rest.reduce((max, at) => (at > max ? at : max), first)
}

type SessionCharge =
  | { kind: "weight"; value: number }
  | { kind: "reps"; value: number }

function sessionCharge(
  sets: readonly { weight_logged: number; reps: string | null }[],
): SessionCharge | null {
  const weights = sets.map((set) => set.weight_logged).filter((kg) => kg > 0)
  if (weights.length > 0) {
    return { kind: "weight", value: Math.max(...weights) }
  }
  const reps = sets
    .map((set) => numericReps(set.reps))
    .filter((n): n is number => n != null)
  if (reps.length > 0) {
    return { kind: "reps", value: Math.max(...reps) }
  }
  return null
}

function evolutionBetween(
  later: SessionCharge | null,
  earlier: SessionCharge | null,
): RegularEvolution | undefined {
  if (later == null || earlier == null || later.kind !== earlier.kind) {
    return undefined
  }
  const delta = later.value - earlier.value
  if (delta === 0) return undefined
  return later.kind === "weight"
    ? { kind: "weight", kg: delta }
    : { kind: "reps", n: delta }
}

export function regularsFromSnapshot(
  snapshot: ProfileSnapshot,
  input: {
    from: string
    to: string
    timeZone: string
    names?: Readonly<Record<string, string>>
  },
): RegularRow[] {
  const sessionById = new Map(
    sessionsInRange(snapshot.sessions, input.from, input.to, input.timeZone).map(
      (session) => [session.id, session] as const,
    ),
  )
  const setsInWindow = snapshot.sets.filter((set) => sessionById.has(set.session_id))
  const exerciseIds = [...new Set(setsInWindow.map((set) => set.exercise_id))]

  return rankRegulars(
    exerciseIds.flatMap((exerciseId) => {
      const sets = setsInWindow.filter((set) => set.exercise_id === exerciseId)
      const sessions = [...new Set(sets.map((set) => set.session_id))]
        .flatMap((id) => {
          const session = sessionById.get(id)
          return session == null ? [] : [session]
        })
        .sort((a, b) => a.finished_at.localeCompare(b.finished_at))
      if (sessions.length < REGULARS_MIN_SESSIONS) return []
      const numeric = sets
        .map((set) => numericReps(set.reps))
        .filter((n): n is number => n != null)
      const lastLoggedAt = latestFinishedAt(sets, sessionById)
      if (lastLoggedAt == null) return []
      const first = sessions[0]
      const last = sessions[sessions.length - 1]
      const evolution =
        first == null || last == null
          ? undefined
          : evolutionBetween(
              sessionCharge(sets.filter((set) => set.session_id === last.id)),
              sessionCharge(sets.filter((set) => set.session_id === first.id)),
            )
      return [
        {
          name: input.names?.[exerciseId] ?? exerciseId,
          reps: numeric.length > 0 ? numeric.reduce((sum, n) => sum + n, 0) : null,
          lastLoggedAt,
          evolution,
        },
      ]
    }),
  )
    .slice(0, REGULARS_LIMIT)
    .map(({ name, reps, evolution }) =>
      evolution == null ? { name, reps } : { name, reps, evolution },
    )
}

const BY_KIND: Record<ProfileWindowKind, readonly RegularRow[]> = {
  "7": [
    { name: "Squat", evolution: { kind: "weight", kg: 2 }, reps: 48 },
    { name: "Bench press", evolution: { kind: "weight", kg: 2.5 }, reps: 40 },
    { name: "Pull-up", evolution: { kind: "reps", n: 1 }, reps: 36 },
    { name: "Row", evolution: { kind: "weight", kg: 2 }, reps: 32 },
    { name: "Deadlift", evolution: { kind: "weight", kg: -2 }, reps: 20 },
  ],
  "30": [
    { name: "Pull-up", evolution: { kind: "reps", n: 2 }, reps: 140 },
    { name: "Row", evolution: { kind: "weight", kg: 2 }, reps: 110 },
    { name: "Squat", evolution: { kind: "weight", kg: 2 }, reps: 108 },
    { name: "Bench press", evolution: { kind: "weight", kg: 2.5 }, reps: 90 },
    { name: "Deadlift", evolution: { kind: "weight", kg: -2 }, reps: 72 },
    { name: "Hip thrust", evolution: { kind: "weight", kg: 5 }, reps: 56 },
    { name: "Overhead press", evolution: { kind: "weight", kg: 2 }, reps: 44 },
  ],
  "100": [
    { name: "Walking lunge", evolution: { kind: "reps", n: 2 }, reps: 80 },
    { name: "Squat", evolution: { kind: "weight", kg: 2 }, reps: 320 },
    { name: "Hip thrust", evolution: { kind: "weight", kg: 5 }, reps: 160 },
    { name: "Pull-up", evolution: { kind: "reps", n: 2 }, reps: 400 },
    { name: "Overhead press", evolution: { kind: "weight", kg: 2 }, reps: 120 },
    { name: "Deadlift", evolution: { kind: "weight", kg: -2 }, reps: 200 },
    { name: "Bench press", evolution: { kind: "weight", kg: 2.5 }, reps: 240 },
    { name: "Row", evolution: { kind: "weight", kg: 2 }, reps: 280 },
  ],
  "365": [
    { name: "Walking lunge", evolution: { kind: "reps", n: 4 }, reps: 220 },
    { name: "Squat", evolution: { kind: "weight", kg: 10 }, reps: 800 },
    { name: "Hip thrust", evolution: { kind: "weight", kg: 10 }, reps: 400 },
    { name: "Pull-up", evolution: { kind: "reps", n: 6 }, reps: 980 },
    { name: "Overhead press", evolution: { kind: "weight", kg: 5 }, reps: 300 },
    { name: "Deadlift", evolution: { kind: "weight", kg: 5 }, reps: 510 },
    { name: "Bench press", evolution: { kind: "weight", kg: 7.5 }, reps: 620 },
    { name: "Row", evolution: { kind: "weight", kg: 5 }, reps: 720 },
  ],
  all: [
    { name: "Walking lunge", evolution: { kind: "reps", n: 6 }, reps: 360 },
    { name: "Squat", evolution: { kind: "weight", kg: 15 }, reps: 1240 },
    { name: "Hip thrust", evolution: { kind: "weight", kg: 15 }, reps: 640 },
    { name: "Pull-up", evolution: { kind: "reps", n: 10 }, reps: 1520 },
    { name: "Overhead press", evolution: { kind: "weight", kg: 7.5 }, reps: 480 },
    { name: "Deadlift", evolution: { kind: "weight", kg: 10 }, reps: 820 },
    { name: "Bench press", evolution: { kind: "weight", kg: 10 }, reps: 980 },
    { name: "Row", evolution: { kind: "weight", kg: 7.5 }, reps: 1100 },
  ],
}

export function pierreRegulars(kind: ProfileWindowKind): readonly RegularRow[] {
  return BY_KIND[kind]
}
