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
