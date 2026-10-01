/** A logged reps row as it lives in the session state (`SessionSetRowReps`). */
export type LoggedSet = { reps: string; weight: string }

/** The pristine target for a set — the Prescription Snapshot (ADR 0006). */
export type Prescription = { reps: number; weight: number }

export type DeviationKind = "load_deviation"

/** Closed vocabulary for a load deviation. Nullable — a skip is data. */
export type DeviationReason =
  | "pain"
  | "fatigue"
  | "strong"
  | "equipment"
  | "form"
  | "other"

/** Ordered for the capture sheet's chip row. */
export const DEVIATION_REASONS: readonly DeviationReason[] = [
  "pain",
  "fatigue",
  "strong",
  "equipment",
  "form",
  "other",
]

/** i18n key for a reason, or the "no reason given" key when skipped. */
export function deviationReasonKey(reason: DeviationReason | null): string {
  return reason ? `deviation.reason.${reason}` : "deviation.reason.none"
}

/** One line of the S3 debrief (T267). Display-ready — numbers already localised. */
export interface DebriefAdjustment {
  id: string
  exerciseName: string
  setNumber: number | null
  prescribed: string
  actual: string
  unit: string
  reasonCode: DeviationReason | null
  note: string | null
}

type AdjustmentLog = {
  weightLogged?: number
  prescribedWeight?: number | null
}

const EM_DASH = "—"

/** Convert kg to the athlete's display unit, rounded to one decimal. */
function formatDisplayWeight(
  kg: number,
  toDisplay: (kg: number) => number,
): string {
  return String(Math.round(toDisplay(kg) * 10) / 10)
}

/**
 * Join a captured deviation with its logged set into a display-ready debrief
 * row. `toDisplay` converts the stored kg to the athlete's unit; a missing log
 * (e.g. drain not finished) degrades to an em dash rather than hiding the row.
 */
export function buildAdjustment(
  deviation: Pick<
    DeviationPayload,
    "workoutExerciseId" | "exerciseId" | "setNumber" | "reasonCode" | "note"
  >,
  log: AdjustmentLog | undefined,
  exerciseName: string,
  toDisplay: (kg: number) => number,
  unit: string,
): DebriefAdjustment {
  const slot = deviation.workoutExerciseId ?? deviation.exerciseId ?? "?"
  const prescribed =
    log?.prescribedWeight != null
      ? formatDisplayWeight(log.prescribedWeight, toDisplay)
      : EM_DASH
  const actual =
    log?.weightLogged != null
      ? formatDisplayWeight(log.weightLogged, toDisplay)
      : EM_DASH

  return {
    id: `${slot}|${deviation.setNumber}`,
    exerciseName,
    setNumber: deviation.setNumber,
    prescribed,
    actual,
    unit,
    reasonCode: deviation.reasonCode,
    note: deviation.note,
  }
}

/** A `session_deviation_events` row as read from the DB. */
export type DeviationRow = {
  id: string
  workoutExerciseId: string | null
  exerciseId: string | null
  setNumber: number | null
  reasonCode: DeviationReason | null
  note: string | null
}

/** A `set_logs` row reduced to what the debrief needs. */
export type SessionLogRow = {
  workoutExerciseId: string | null
  exerciseId: string | null
  setNumber: number
  weightLogged: number | null
  prescribedWeight: number | null
  exerciseNameSnapshot: string | null
}

/**
 * Join deviation rows to their logged sets for the S3 debrief (T267). Reads the
 * table, not the offline queue — the queue is drained before the finish screen
 * renders. A deviation whose set log cannot be matched still appears, numbers
 * degraded to an em dash, so the reason is never hidden.
 */
export function mergeSessionDeviations(
  deviations: DeviationRow[],
  logs: SessionLogRow[],
  toDisplay: (kg: number) => number,
  unit: string,
): DebriefAdjustment[] {
  return deviations.map((deviation) => {
    const slot = deviation.workoutExerciseId ?? deviation.exerciseId
    const log = logs.find(
      (l) =>
        (l.workoutExerciseId ?? l.exerciseId) === slot &&
        l.setNumber === deviation.setNumber,
    )
    return buildAdjustment(
      {
        workoutExerciseId: deviation.workoutExerciseId,
        exerciseId: deviation.exerciseId,
        setNumber: deviation.setNumber ?? 0,
        reasonCode: deviation.reasonCode,
        note: deviation.note,
      },
      log
        ? {
            weightLogged: log.weightLogged ?? undefined,
            prescribedWeight: log.prescribedWeight,
          }
        : undefined,
      log?.exerciseNameSnapshot ?? "Exercise",
      toDisplay,
      unit,
    )
  })
}

export type LoadDeviationInput = {
  sessionId: string
  workoutExerciseId: string | null
  exerciseId: string | null
  setNumber: number
  reasonCode: DeviationReason | null
  note: string | null
}

export type DeviationPayload = LoadDeviationInput & { kind: DeviationKind }

/**
 * True when the confirmed set diverges from its Prescription Snapshot on the
 * load axes (weight or reps). In-session, set-level only (T266).
 */
export function isLoadDeviation(
  row: LoggedSet,
  prescription: Prescription,
): boolean {
  return (
    Number(row.weight) !== prescription.weight ||
    parseInt(row.reps, 10) !== prescription.reps
  )
}

/** Shape a load-deviation event. Trims the note; a blank note collapses to null. */
export function buildLoadDeviationPayload(
  input: LoadDeviationInput,
): DeviationPayload {
  const note = input.note?.trim() || null
  return { ...input, kind: "load_deviation", note }
}
