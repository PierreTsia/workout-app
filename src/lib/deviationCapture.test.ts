import { describe, expect, it } from "vitest"
import {
  buildAdjustment,
  buildLoadDeviationPayload,
  deviationReasonKey,
  isLoadDeviation,
  mergeSessionDeviations,
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

  it("rounds the converted numbers to one decimal (lbs noise)", () => {
    const adjustment = buildAdjustment(
      deviation,
      { weightLogged: 30, prescribedWeight: 27.5 },
      "Bench Press",
      (kg) => kg * 2.20462,
      "lbs",
    )

    expect(adjustment.prescribed).toBe("60.6")
    expect(adjustment.actual).toBe("66.1")
  })
})

describe("mergeSessionDeviations", () => {
  const deviationRow = {
    id: "d1",
    workoutExerciseId: "we1",
    exerciseId: "ex1",
    setNumber: 2,
    reasonCode: "fatigue" as const,
    note: "mal dormi",
  }

  it("joins a deviation to its logged set for name and numbers", () => {
    const rows = mergeSessionDeviations(
      [deviationRow],
      [
        {
          workoutExerciseId: "we1",
          exerciseId: "ex1",
          setNumber: 2,
          weightLogged: 72.5,
          prescribedWeight: 80,
          exerciseNameSnapshot: "Bench Press",
        },
      ],
      (kg) => kg,
      "kg",
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      exerciseName: "Bench Press",
      prescribed: "80",
      actual: "72.5",
      reasonCode: "fatigue",
      note: "mal dormi",
    })
  })

  it("still lists a deviation whose set log is missing (degraded, not hidden)", () => {
    const rows = mergeSessionDeviations([deviationRow], [], (kg) => kg, "kg")

    expect(rows).toHaveLength(1)
    expect(rows[0].prescribed).toBe("—")
    expect(rows[0].actual).toBe("—")
  })
})
