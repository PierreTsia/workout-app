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

/** Catalog row used to resolve a display name at render (ADR 0010). */
export interface CatalogName {
  name: string | null
  name_en: string | null
}

/**
 * One line of the S3 debrief (T267). Display-ready for weights; the exercise
 * name is resolved at render (ADR 0010) from `catalogExercise` with
 * `exerciseNameSnapshot` as fallback — never from the frozen snapshot alone.
 * `weightChanged` / `repsChanged` tell the UI which axis actually deviated, so
 * a reps-only deviation never renders as `60 → 60 kg`.
 */
export interface DebriefAdjustment {
  id: string
  exerciseNameSnapshot: string | null
  catalogExercise: CatalogName | null
  setNumber: number | null
  prescribed: string
  actual: string
  unit: string
  weightChanged: boolean
  prescribedReps: string | null
  actualReps: string | null
  repsChanged: boolean
  reasonCode: DeviationReason | null
  note: string | null
}

type AdjustmentLog = {
  weightLogged?: number | null
  prescribedWeight?: number | null
  repsLogged?: string | number | null
  prescribedReps?: number | null
}

type AdjustmentNaming = {
  exerciseNameSnapshot: string | null
  catalogExercise: CatalogName | null
}

const EM_DASH = "—"

/** Convert kg to the athlete's display unit, rounded to one decimal. */
function formatDisplayWeight(
  kg: number,
  toDisplay: (kg: number) => number,
): string {
  return String(Math.round(toDisplay(kg) * 10) / 10)
}

const asReps = (value: string | number | null | undefined): string | null => {
  if (value == null || value === "") return null
  return String(value)
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
  naming: AdjustmentNaming,
  toDisplay: (kg: number) => number,
  unit: string,
): DebriefAdjustment {
  const slot = deviation.workoutExerciseId ?? deviation.exerciseId ?? "?"
  const prescribedWeight =
    log?.prescribedWeight != null
      ? formatDisplayWeight(log.prescribedWeight, toDisplay)
      : null
  const actualWeight =
    log?.weightLogged != null
      ? formatDisplayWeight(log.weightLogged, toDisplay)
      : null
  const prescribedReps = asReps(log?.prescribedReps)
  const actualReps = asReps(log?.repsLogged)

  return {
    id: `${slot}|${deviation.setNumber}`,
    exerciseNameSnapshot: naming.exerciseNameSnapshot,
    catalogExercise: naming.catalogExercise,
    setNumber: deviation.setNumber,
    prescribed: prescribedWeight ?? EM_DASH,
    actual: actualWeight ?? EM_DASH,
    unit,
    weightChanged:
      prescribedWeight != null &&
      actualWeight != null &&
      prescribedWeight !== actualWeight,
    prescribedReps,
    actualReps,
    repsChanged:
      prescribedReps != null && actualReps != null && prescribedReps !== actualReps,
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
  weightLogged?: number | null
  prescribedWeight?: number | null
  repsLogged?: string | number | null
  prescribedReps?: number | null
  exerciseNameSnapshot?: string | null
  catalogExercise?: CatalogName | null
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
      log,
      {
        exerciseNameSnapshot: log?.exerciseNameSnapshot ?? null,
        catalogExercise: log?.catalogExercise ?? null,
      },
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
