/**
 * Edge port of `src/lib/amrapScore.ts` (T186 / #474).
 * No `@/` imports — Deno Edge only.
 */

export interface AmrapScoreCell {
  session_id: string
  set_number: number
  reps_logged: string | null
  duration_seconds: number | null
  logged_at: string
  exercise_name: string
}

export interface AmrapScoreValue {
  fullRounds: number
  leftover: number
  leftoverName: string
}

function leftoverOf(cells: AmrapScoreCell[]): AmrapScoreCell | null {
  return cells.reduce<AmrapScoreCell | null>((best, cell) => {
    if (best == null) return cell
    if (cell.set_number !== best.set_number) {
      return cell.set_number > best.set_number ? cell : best
    }
    return cell.logged_at > best.logged_at ? cell : best
  }, null)
}

function cellActual(cell: AmrapScoreCell): number {
  if (cell.duration_seconds != null) return cell.duration_seconds
  if (cell.reps_logged == null) return 0
  return Number.parseInt(cell.reps_logged, 10) || 0
}

/**
 * Score one AMRAP from its leftover cell. Completeness is
 * `block_runs.finished_at IS NOT NULL` — unfinished runs have no score.
 * Leftover is the last logged cell (ragged last round); full rounds are
 * everything before that set_number.
 */
export function amrapScore(
  run: { finished_at: string | null },
  cells: AmrapScoreCell[],
): AmrapScoreValue | null {
  if (run.finished_at == null) return null
  const leftoverCell = leftoverOf(cells)
  if (leftoverCell == null) return null
  return {
    fullRounds: leftoverCell.set_number - 1,
    leftover: cellActual(leftoverCell),
    leftoverName: leftoverCell.exercise_name,
  }
}

export interface AmrapHistoryRun {
  session_id: string
  started_at: string
  finished_at: string | null
  template_fingerprint: string
}

export interface AmrapRunView {
  sessionId: string
  date: string
  fingerprint: string
  isComplete: boolean
  score: AmrapScoreValue | null
  /** vs previous complete run of the same fingerprint; positive = more rounds. */
  deltaRounds: number | null
  isPb: boolean
  shapeChanged: boolean
}

function compareScores(a: AmrapScoreValue, b: AmrapScoreValue): number {
  return a.fullRounds - b.fullRounds || a.leftover - b.leftover
}

function hasScore<T extends { score: AmrapScoreValue | null }>(
  run: T | null | undefined,
): run is T & { score: AmrapScoreValue } {
  return run != null && run.score != null
}

/**
 * Newest-first AMRAP history: PB is max (fullRounds, leftover) per
 * `template_fingerprint`. Unfinished runs (no finished_at) never enter a PB
 * group. Tours CCT is a different lib — do not mix modes in one group.
 */
export function annotateAmrapRuns(
  runs: AmrapHistoryRun[],
  cells: AmrapScoreCell[],
): AmrapRunView[] {
  const cellsBySession = cells.reduce<Map<string, AmrapScoreCell[]>>(
    (acc, cell) => {
      acc.set(cell.session_id, [...(acc.get(cell.session_id) ?? []), cell])
      return acc
    },
    new Map(),
  )

  const chronological = [...runs]
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((run) => ({
      sessionId: run.session_id,
      date: run.started_at,
      fingerprint: run.template_fingerprint,
      isComplete: run.finished_at != null,
      score: amrapScore(run, cellsBySession.get(run.session_id) ?? []),
    }))

  type ScoredRun = (typeof chronological)[number] & { score: AmrapScoreValue }

  const completeByFingerprint = chronological.filter(hasScore).reduce(
    (acc, run) => {
      acc.set(run.fingerprint, [...(acc.get(run.fingerprint) ?? []), run])
      return acc
    },
    new Map<string, ScoredRun[]>(),
  )

  const pbSessionByFingerprint = new Map(
    [...completeByFingerprint.entries()]
      .filter(([, group]) => group.length >= 2)
      .map(([fingerprint, group]) => {
        const best = group.reduce((top, run) =>
          compareScores(run.score, top.score) > 0 ? run : top,
        )
        return [fingerprint, best.sessionId] as const
      }),
  )

  return chronological
    .map((run, i) => {
      const priorSame = chronological
        .slice(0, i)
        .filter((r) => r.isComplete && r.fingerprint === run.fingerprint)
        .at(-1)
      const deltaRounds =
        hasScore(run) && hasScore(priorSame)
          ? run.score.fullRounds - priorSame.score.fullRounds
          : null
      const previous = chronological[i - 1]
      return {
        ...run,
        deltaRounds,
        isPb: pbSessionByFingerprint.get(run.fingerprint) === run.sessionId,
        shapeChanged:
          previous != null && previous.fingerprint !== run.fingerprint,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}
