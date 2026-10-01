import { describe, expect, it } from "vitest"
import {
  buildAdjustment,
  buildLoadDeviationPayload,
  deviationReasonKey,
  isLoadDeviation,
} from "@/lib/deviationCapture"

type Row = { reps: string; weight: string }
type Prescription = { reps: number; weight: number }

function makeRow(overrides: Partial<Row> = {}): Row {
  return { reps: "8", weight: "80", ...overrides }
}

function makePrescription(
  overrides: Partial<Prescription> = {},
): Prescription {
  return { reps: 8, weight: 80, ...overrides }
}

describe("isLoadDeviation", () => {
  it("is false when the logged set matches the prescription", () => {
    expect(isLoadDeviation(makeRow(), makePrescription())).toBe(false)
  })

  it("is true when the logged weight differs from the prescription", () => {
    expect(
      isLoadDeviation(makeRow({ weight: "72.5" }), makePrescription()),
    ).toBe(true)
  })

  it("is true when the logged reps differ from the prescription", () => {
    expect(isLoadDeviation(makeRow({ reps: "6" }), makePrescription())).toBe(
      true,
    )
  })
})

describe("buildLoadDeviationPayload", () => {
  const base = {
    sessionId: "s1",
    workoutExerciseId: "we1",
    exerciseId: "ex1",
    setNumber: 2,
  }

  it("tags the event as a load deviation and keeps the reason", () => {
    const payload = buildLoadDeviationPayload({
      ...base,
      reasonCode: "fatigue",
      note: null,
    })
    expect(payload).toMatchObject({
      ...base,
      kind: "load_deviation",
      reasonCode: "fatigue",
    })
  })

  it("keeps a null reason — the skip is data", () => {
    const payload = buildLoadDeviationPayload({
      ...base,
      reasonCode: null,
      note: null,
    })
    expect(payload.reasonCode).toBeNull()
  })

  it("trims the note and collapses a blank note to null", () => {
    expect(
      buildLoadDeviationPayload({ ...base, reasonCode: null, note: "  hi  " })
        .note,
    ).toBe("hi")
    expect(
      buildLoadDeviationPayload({ ...base, reasonCode: null, note: "   " })
        .note,
    ).toBeNull()
  })
})

describe("deviationReasonKey", () => {
  it("maps a reason to its i18n key", () => {
    expect(deviationReasonKey("fatigue")).toBe("deviation.reason.fatigue")
  })

  it("maps a null reason to the 'none' key — the skip is shown, not hidden", () => {
    expect(deviationReasonKey(null)).toBe("deviation.reason.none")
  })
})

describe("buildAdjustment", () => {
  const deviation = {
    workoutExerciseId: "we1",
    exerciseId: "ex1",
    setNumber: 2,
    reasonCode: "fatigue" as const,
    note: null,
  }

  it("formats prescribed and actual in display units", () => {
    const adjustment = buildAdjustment(
      deviation,
      { weightLogged: 72.5, prescribedWeight: 80 },
      "Bench Press",
      (kg) => kg,
      "kg",
    )

    expect(adjustment).toMatchObject({
      exerciseName: "Bench Press",
      setNumber: 2,
      prescribed: "80",
      actual: "72.5",
      unit: "kg",
      reasonCode: "fatigue",
      note: null,
    })
  })

  it("falls back to an em dash when the log is missing", () => {
    const adjustment = buildAdjustment(
      deviation,
      undefined,
      "Squat",
      (kg) => kg,
      "kg",
    )

    expect(adjustment.prescribed).toBe("—")
    expect(adjustment.actual).toBe("—")
  })
})
