/**
 * Pure derivation of circuit (Exercise Block) completion time and trend from
 * `set_logs` rows — no schema, no writeback, no progression engine (ADR 0008).
 * Completion time is wall-clock between the first and last logged cell of a
 * run; pauses are included by design.
 */

export interface BlockRunCellRow {
  session_id: string
  block_exercise_id: string
  set_number: number
  reps_logged: string | null
  duration_seconds: number | null
  weight_logged: number
  logged_at: string
}

/** One execution of a circuit in a single session, derived from its cells. */
export interface BlockRun {
  sessionId: string
  /** Earliest `logged_at` of the run — used for ordering and trend x-labels. */
  date: string
  completionSeconds: number
  fingerprint: string
  isComplete: boolean
}

/** Wall-clock seconds between the first and last logged cell of a run. */
export function runCompletionSeconds(cells: BlockRunCellRow[]): number {
  const times = cells.map((c) => new Date(c.logged_at).getTime())
  return Math.round((Math.max(...times) - Math.min(...times)) / 1000)
}

/** The logged amount of a cell — reps, or a duration tagged to avoid colliding with a rep count. */
function cellAmount(cell: BlockRunCellRow): string {
  return cell.reps_logged ?? `d${cell.duration_seconds}`
}

/**
 * Stable identity of a run's prescription for comparability: which exercises,
 * which rounds, and the amount + weight of every cell. Weight is included on
 * purpose (ADR 0008) — adding load is a harder circuit, so its time is not
 * comparable. Order-independent.
 */
export function runFingerprint(cells: BlockRunCellRow[]): string {
  return cells
    .map((c) => `${c.block_exercise_id}:${c.set_number}:${cellAmount(c)}:${c.weight_logged}`)
    .sort()
    .join("|")
}

/**
 * A run "counts" only when it forms a full rectangle: contiguous rounds `1..R`,
 * each round logging exactly the same set of exercise slots (no ragged last
 * round, no gaps). Self-contained — needs no block template — so it stays
 * retroactive and robust to later Builder edits (ADR 0008). A clean shorter run
 * (rounds 1..3 of an intended 4) reads as a complete 3-round run by design.
 */
export function isRunComplete(cells: BlockRunCellRow[]): boolean {
  if (cells.length === 0) return false
  const rounds = [...new Set(cells.map((c) => c.set_number))].sort((a, b) => a - b)
  const contiguousFromOne = rounds.every((round, i) => round === i + 1)
  if (!contiguousFromOne) return false
  const slotsPerRound = new Set(cells.map((c) => c.block_exercise_id)).size
  return rounds.every((round) => {
    const slots = cells
      .filter((c) => c.set_number === round)
      .map((c) => c.block_exercise_id)
    return slots.length === slotsPerRound && new Set(slots).size === slotsPerRound
  })
}

/** Earliest `logged_at` of a run. */
function runDate(cells: BlockRunCellRow[]): string {
  return cells.reduce((min, c) => (c.logged_at < min ? c.logged_at : min), cells[0].logged_at)
}

/**
 * Collapse raw cross-session cells into one {@link BlockRun} per session,
 * newest-first. Pure derivation — the source `set_logs` are untouched.
 */
export function computeBlockRuns(rows: BlockRunCellRow[]): BlockRun[] {
  const bySession = rows.reduce<Map<string, BlockRunCellRow[]>>((acc, row) => {
    acc.set(row.session_id, [...(acc.get(row.session_id) ?? []), row])
    return acc
  }, new Map())

  return [...bySession.values()]
    .map((cells) => ({
      sessionId: cells[0].session_id,
      date: runDate(cells),
      completionSeconds: runCompletionSeconds(cells),
      fingerprint: runFingerprint(cells),
      isComplete: isRunComplete(cells),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** A run plus the comparisons that make it meaningful in the history sheet. */
export interface BlockRunView {
  run: BlockRun
  /** vs the previous complete run of the same shape; negative = faster. `null` when not comparable. */
  deltaSeconds: number | null
  /** Fastest complete run within its fingerprint group (only when the group has ≥2 complete runs). */
  isPb: boolean
  /** The immediately-previous run had a different shape — the prescription was edited. */
  shapeChanged: boolean
}

/**
 * Annotate runs with honest comparisons (ADR 0008): a delta only against the
 * previous complete run of the **same** fingerprint, a PB per fingerprint group
 * (and only when there is something to beat), and a `shapeChanged` marker at the
 * boundary where the prescription differs from the previous run. Returns
 * newest-first (list order); incomplete runs never anchor a comparison.
 */
export function annotateRuns(runs: BlockRun[]): BlockRunView[] {
  const chronological = [...runs].sort((a, b) => a.date.localeCompare(b.date))

  const completeByFingerprint = chronological
    .filter((r) => r.isComplete)
    .reduce<Map<string, BlockRun[]>>((acc, r) => {
      acc.set(r.fingerprint, [...(acc.get(r.fingerprint) ?? []), r])
      return acc
    }, new Map())

  const pbSessionByFingerprint = new Map(
    [...completeByFingerprint.entries()]
      .filter(([, group]) => group.length >= 2)
      .map(([fingerprint, group]) => {
        const fastest = group.reduce((best, r) =>
          r.completionSeconds < best.completionSeconds ? r : best,
        )
        return [fingerprint, fastest.sessionId] as const
      }),
  )

  return chronological
    .map((run, i) => {
      const previous = chronological[i - 1]
      const priorSameShape = chronological
        .slice(0, i)
        .filter((r) => r.isComplete && r.fingerprint === run.fingerprint)
        .at(-1)
      const deltaSeconds =
        run.isComplete && priorSameShape != null
          ? run.completionSeconds - priorSameShape.completionSeconds
          : null
      return {
        run,
        deltaSeconds,
        isPb: pbSessionByFingerprint.get(run.fingerprint) === run.sessionId,
        shapeChanged: previous != null && previous.fingerprint !== run.fingerprint,
      }
    })
    .sort((a, b) => b.run.date.localeCompare(a.run.date))
}

/** Trend points to plot: completion times and their run dates, index-aligned. */
export interface CompletionTrend {
  /** Completion seconds, oldest → newest. */
  seconds: number[]
  /** Run dates (earliest `logged_at`), oldest → newest — chart x-labels. */
  dates: string[]
}

/**
 * Trend points (oldest → newest) for the chart, restricted to the shape of the
 * most-recent complete run so a line never mixes prescriptions (ADR 0008).
 * Both arrays are empty when that shape has fewer than two complete runs —
 * nothing to plot.
 */
export function completionTrend(views: BlockRunView[]): CompletionTrend {
  const mostRecentComplete = views.find((v) => v.run.isComplete)
  if (mostRecentComplete == null) return { seconds: [], dates: [] }
  const { fingerprint } = mostRecentComplete.run
  const ordered = views
    .filter((v) => v.run.isComplete && v.run.fingerprint === fingerprint)
    .sort((a, b) => a.run.date.localeCompare(b.run.date))
  if (ordered.length < 2) return { seconds: [], dates: [] }
  return {
    seconds: ordered.map((v) => v.run.completionSeconds),
    dates: ordered.map((v) => v.run.date),
  }
}

/** Completion times only (oldest → newest); see {@link completionTrend}. */
export function completionTrendSeries(views: BlockRunView[]): number[] {
  return completionTrend(views).seconds
}
