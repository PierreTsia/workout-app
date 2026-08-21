import { amrapScore, type AmrapScoreCell, type AmrapScoreValue } from "@/lib/amrapScore"
import {
  circuitBestAmrap,
  circuitBestTours,
  circuitSparkValues,
  includeDeltas,
  type CircuitRowFixture,
  type ProfileWindowKind,
} from "@/lib/profile/window"

export type CircuitAmrapBest = AmrapScoreValue

export type CircuitToursBest = {
  seconds: number
}

export type CircuitLedgerRun =
  | {
      mode: "amrap"
      sessionId: string
      startedAt: string
      finishedAt: string | null
      fingerprint: string
      catalogId: string | null
      name: string
      capSeconds: number
      cells: AmrapScoreCell[]
    }
  | {
      mode: "rounds"
      sessionId: string
      startedAt: string
      fingerprint: string
      catalogId: string | null
      name: string
      rounds: number
      seconds: number
      isComplete: boolean
    }

export type CircuitLedgerRowVm =
  | {
      mode: "amrap"
      fingerprint: string
      name: string
      minutes: number
      pb: boolean
      runCount: number
      best: CircuitAmrapBest
      sparkValues: readonly number[]
    }
  | {
      mode: "rounds"
      fingerprint: string
      name: string
      rounds: number
      pb: boolean
      runCount: number
      best: CircuitToursBest
      sparkValues: readonly number[]
    }

export type CircuitLedgerPulse = {
  runs: number
  distinct: number
  pbs: number
  runsDelta: number | null
  distinctDelta: number | null
  pbsDelta: number | null
}

export type CircuitLedgerVm =
  | { status: "empty"; pulse: CircuitLedgerPulse; rows: [] }
  | { status: "ok"; pulse: CircuitLedgerPulse; rows: CircuitLedgerRowVm[] }

const WINDOW_DAYS: Record<Exclude<ProfileWindowKind, "all">, number> = {
  "7": 7,
  "30": 30,
  "100": 100,
  "365": 365,
}

const SPARK_LIMIT = 8

type ScoredAmrap = {
  mode: "amrap"
  sessionId: string
  startedAt: string
  day: string
  fingerprint: string
  name: string
  minutes: number
  score: AmrapScoreValue
}

type ScoredTours = {
  mode: "rounds"
  sessionId: string
  startedAt: string
  day: string
  fingerprint: string
  name: string
  rounds: number
  seconds: number
}

type ScoredRun = ScoredAmrap | ScoredTours

function localIsoDay(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addIsoDays(isoDay: string, days: number): string {
  const [year, month, day] = isoDay.split("-").map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const y = String(utc.getUTCFullYear())
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const d = String(utc.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function windowRange(
  kind: ProfileWindowKind,
  today: string,
): { from: string; to: string } | null {
  if (kind === "all") return null
  return { from: addIsoDays(today, -(WINDOW_DAYS[kind] - 1)), to: today }
}

function priorWindowRange(range: { from: string; to: string }): {
  from: string
  to: string
} {
  const fromParts = range.from.split("-").map(Number)
  const toParts = range.to.split("-").map(Number)
  const start = Date.UTC(fromParts[0], (fromParts[1] ?? 1) - 1, fromParts[2])
  const end = Date.UTC(toParts[0], (toParts[1] ?? 1) - 1, toParts[2])
  const days = Math.round((end - start) / 86_400_000) + 1
  const priorTo = addIsoDays(range.from, -1)
  return { from: addIsoDays(priorTo, -(days - 1)), to: priorTo }
}

function inRange(day: string, range: { from: string; to: string } | null): boolean {
  if (range == null) return true
  return day >= range.from && day <= range.to
}

function compareAmrap(a: AmrapScoreValue, b: AmrapScoreValue): number {
  return a.fullRounds - b.fullRounds || a.leftover - b.leftover
}

function scoreRun(run: CircuitLedgerRun): ScoredRun | null {
  if (run.catalogId == null) return null
  const day = localIsoDay(new Date(run.startedAt))
  if (run.mode === "amrap") {
    const score = amrapScore({ finished_at: run.finishedAt }, run.cells)
    if (score == null) return null
    return {
      mode: "amrap",
      sessionId: run.sessionId,
      startedAt: run.startedAt,
      day,
      fingerprint: run.fingerprint,
      name: run.name,
      minutes: Math.round(run.capSeconds / 60),
      score,
    }
  }
  if (!run.isComplete) return null
  return {
    mode: "rounds",
    sessionId: run.sessionId,
    startedAt: run.startedAt,
    day,
    fingerprint: run.fingerprint,
    name: run.name,
    rounds: run.rounds,
    seconds: run.seconds,
  }
}

function amrapBeatsCareer(candidate: ScoredAmrap, best: ScoredAmrap): boolean {
  return compareAmrap(candidate.score, best.score) > 0
}

function careerBestSession(group: readonly ScoredRun[]): string | null {
  if (group.length < 2) return null
  const [first, ...rest] = group
  if (first == null) return null
  if (first.mode === "amrap") {
    const amraps = [first, ...rest].filter(
      (run): run is ScoredAmrap => run.mode === "amrap",
    )
    const best = amraps.reduce((top, run) => (amrapBeatsCareer(run, top) ? run : top))
    return best.sessionId
  }
  const tours = [first, ...rest].filter(
    (run): run is ScoredTours => run.mode === "rounds",
  )
  const fastest = tours.reduce((top, run) =>
    run.seconds < top.seconds ? run : top,
  )
  return fastest.sessionId
}

function bestAmrapInWindow(runs: readonly ScoredAmrap[]): AmrapScoreValue | null {
  const [first, ...rest] = runs
  if (first == null) return null
  return rest.reduce(
    (best, run) => (compareAmrap(run.score, best) > 0 ? run.score : best),
    first.score,
  )
}

function lastEightSpark(runs: readonly ScoredRun[]): readonly number[] {
  const chronological = [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const last = chronological.slice(-SPARK_LIMIT)
  return last.map((run) => (run.mode === "amrap" ? run.score.fullRounds : run.seconds))
}

function emptyPulse(includePrior: boolean): CircuitLedgerPulse {
  return {
    runs: 0,
    distinct: 0,
    pbs: 0,
    runsDelta: includePrior ? 0 : null,
    distinctDelta: includePrior ? 0 : null,
    pbsDelta: includePrior ? 0 : null,
  }
}

function countPbs(
  groups: ReadonlyMap<string, ScoredRun[]>,
  range: { from: string; to: string } | null,
): number {
  return [...groups.values()].filter((group) => {
    const pbSession = careerBestSession(group)
    if (pbSession == null) return false
    const pbRun = group.find((run) => run.sessionId === pbSession)
    return pbRun != null && inRange(pbRun.day, range)
  }).length
}

function rowFromGroup(
  group: readonly ScoredRun[],
  windowRuns: readonly ScoredRun[],
): CircuitLedgerRowVm | null {
  const [sample] = windowRuns
  if (sample == null) return null
  const pbSession = careerBestSession(group)
  const pb =
    pbSession != null && windowRuns.some((run) => run.sessionId === pbSession)
  const sparkValues = lastEightSpark(windowRuns)
  if (sample.mode === "amrap") {
    const amraps = windowRuns.filter(
      (run): run is ScoredAmrap => run.mode === "amrap",
    )
    const best = bestAmrapInWindow(amraps)
    if (best == null) return null
    return {
      mode: "amrap",
      fingerprint: sample.fingerprint,
      name: sample.name,
      minutes: sample.minutes,
      pb,
      runCount: windowRuns.length,
      best,
      sparkValues,
    }
  }
  const tours = windowRuns.filter(
    (run): run is ScoredTours => run.mode === "rounds",
  )
  const best = tours.reduce((top, run) =>
    run.seconds < top.seconds ? run : top,
  )
  return {
    mode: "rounds",
    fingerprint: sample.fingerprint,
    name: sample.name,
    rounds: sample.rounds,
    pb,
    runCount: windowRuns.length,
    best: { seconds: best.seconds },
    sparkValues,
  }
}

export function circuitLedger(
  runs: readonly CircuitLedgerRun[],
  input: { kind: ProfileWindowKind; now: Date },
): CircuitLedgerVm {
  const today = localIsoDay(input.now)
  const range = windowRange(input.kind, today)
  const showDeltas = includeDeltas(input.kind)
  const scored = runs
    .map(scoreRun)
    .filter((run): run is ScoredRun => run != null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  const byFingerprint = scored.reduce<Map<string, ScoredRun[]>>((acc, run) => {
    acc.set(run.fingerprint, [...(acc.get(run.fingerprint) ?? []), run])
    return acc
  }, new Map())

  const windowRuns = scored.filter((run) => inRange(run.day, range))
  const priorRuns =
    range == null || !showDeltas
      ? []
      : scored.filter((run) => inRange(run.day, priorWindowRange(range)))
  const windowByFingerprint = windowRuns.reduce<Map<string, ScoredRun[]>>(
    (acc, run) => {
      acc.set(run.fingerprint, [...(acc.get(run.fingerprint) ?? []), run])
      return acc
    },
    new Map(),
  )
  const priorByFingerprint = priorRuns.reduce<Map<string, ScoredRun[]>>(
    (acc, run) => {
      acc.set(run.fingerprint, [...(acc.get(run.fingerprint) ?? []), run])
      return acc
    },
    new Map(),
  )

  const rows = [...windowByFingerprint.entries()]
    .map(([fingerprint, group]) =>
      rowFromGroup(byFingerprint.get(fingerprint) ?? [], group),
    )
    .filter((row): row is CircuitLedgerRowVm => row != null)

  const pbs = countPbs(byFingerprint, range)
  const priorPbs =
    range == null || !showDeltas
      ? 0
      : countPbs(byFingerprint, priorWindowRange(range))
  const pulse: CircuitLedgerPulse = {
    runs: windowRuns.length,
    distinct: windowByFingerprint.size,
    pbs,
    runsDelta: showDeltas ? windowRuns.length - priorRuns.length : null,
    distinctDelta: showDeltas
      ? windowByFingerprint.size - priorByFingerprint.size
      : null,
    pbsDelta: showDeltas ? pbs - priorPbs : null,
  }

  if (rows.length === 0) {
    return { status: "empty", pulse: emptyPulse(showDeltas), rows: [] }
  }

  return { status: "ok", pulse, rows }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  if (value == null) return null
  return typeof value === "string" ? value : null
}

function asIsoString(value: unknown): string | null {
  if (typeof value === "string") return value
  return null
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseCell(raw: unknown): AmrapScoreCell | null {
  if (!isRecord(raw)) return null
  const sessionId = asIsoString(raw.session_id)
  const setNumber = asFiniteNumber(raw.set_number)
  const loggedAt = asIsoString(raw.logged_at)
  const exerciseName = asIsoString(raw.exercise_name)
  if (sessionId == null || setNumber == null || loggedAt == null || exerciseName == null) {
    return null
  }
  const duration = raw.duration_seconds
  return {
    session_id: sessionId,
    set_number: setNumber,
    reps_logged: stringOrNull(raw.reps_logged),
    duration_seconds:
      duration == null ? null : asFiniteNumber(duration),
    logged_at: loggedAt,
    exercise_name: exerciseName,
  }
}

function parseAmrapRun(raw: Record<string, unknown>): CircuitLedgerRun | null {
  const sessionId = asIsoString(raw.session_id)
  const startedAt = asIsoString(raw.started_at)
  const fingerprint = asIsoString(raw.template_fingerprint)
  const catalogId = stringOrNull(raw.benchmark_circuit_id)
  const name = asIsoString(raw.label)
  const capSeconds = asFiniteNumber(raw.cap_seconds)
  if (
    sessionId == null ||
    startedAt == null ||
    fingerprint == null ||
    catalogId == null ||
    name == null ||
    capSeconds == null
  ) {
    return null
  }
  const cellsRaw = raw.cells
  const cells = Array.isArray(cellsRaw)
    ? cellsRaw.map(parseCell).filter((cell): cell is AmrapScoreCell => cell != null)
    : []
  return {
    mode: "amrap",
    sessionId,
    startedAt,
    finishedAt: stringOrNull(raw.finished_at),
    fingerprint,
    catalogId,
    name,
    capSeconds,
    cells,
  }
}

function parseToursRun(raw: Record<string, unknown>): CircuitLedgerRun | null {
  const sessionId = asIsoString(raw.session_id)
  const startedAt = asIsoString(raw.started_at)
  const fingerprint = asIsoString(raw.template_fingerprint)
  const catalogId = stringOrNull(raw.benchmark_circuit_id)
  const name = asIsoString(raw.label)
  const rounds = asFiniteNumber(raw.rounds)
  const seconds = asFiniteNumber(raw.seconds)
  if (
    sessionId == null ||
    startedAt == null ||
    fingerprint == null ||
    catalogId == null ||
    name == null ||
    rounds == null ||
    seconds == null
  ) {
    return null
  }
  return {
    mode: "rounds",
    sessionId,
    startedAt,
    fingerprint,
    catalogId,
    name,
    rounds,
    seconds,
    isComplete: raw.is_complete !== false,
  }
}

export function parseCircuitLedgerPayload(data: unknown): CircuitLedgerRun[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((row) => {
    if (!isRecord(row)) return []
    if (row.mode === "rounds") {
      const parsed = parseToursRun(row)
      return parsed == null ? [] : [parsed]
    }
    const parsed = parseAmrapRun(row)
    return parsed == null ? [] : [parsed]
  })
}

export function circuitRowFromFixture(
  row: CircuitRowFixture,
): CircuitLedgerRowVm | null {
  if (row.mode === "amrap") {
    const best = circuitBestAmrap(row.runs)
    if (best == null) return null
    return {
      mode: "amrap",
      fingerprint: row.name,
      name: row.name,
      minutes: row.minutes,
      pb: row.pb,
      runCount: row.runCount,
      best,
      sparkValues: circuitSparkValues(row),
    }
  }
  const best = circuitBestTours(row.runs)
  if (best == null) return null
  return {
    mode: "rounds",
    fingerprint: row.name,
    name: row.name,
    rounds: row.rounds,
    pb: row.pb,
    runCount: row.runCount,
    best,
    sparkValues: circuitSparkValues(row),
  }
}
