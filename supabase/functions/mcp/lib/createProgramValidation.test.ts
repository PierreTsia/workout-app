import { describe, expect, it } from "vitest"
import {
  detectLegacyExerciseIds,
  LEGACY_MIGRATION_ERROR_MESSAGE,
  parseExerciseInput,
  validateRepsModeCrossField,
} from "./createProgramValidation"

const VALID_UUID = "11111111-2222-4333-8444-555555555555"
const VALID_UUID_2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const DAY = "Push"

describe("detectLegacyExerciseIds", () => {
  it("returns true when at least one day has the v0.2.x exercise_ids field", () => {
    const args = {
      name: "Push 5d",
      days: [{ label: "Push", exercise_ids: [VALID_UUID] }],
    }
    expect(detectLegacyExerciseIds(args)).toBe(true)
  })

  it("returns true even if only ONE of multiple days uses exercise_ids (mixed legacy/new)", () => {
    const args = {
      name: "Push 5d",
      days: [
        { label: "Push", exercises: [VALID_UUID] },
        { label: "Pull", exercise_ids: [VALID_UUID] },
      ],
    }
    expect(detectLegacyExerciseIds(args)).toBe(true)
  })

  it("returns false on the new v0.3.0 shape (exercises only)", () => {
    const args = {
      name: "Push 5d",
      days: [{ label: "Push", exercises: [VALID_UUID] }],
    }
    expect(detectLegacyExerciseIds(args)).toBe(false)
  })

  it("returns false when days is missing or not an array (defensive — error surfaces upstream)", () => {
    expect(detectLegacyExerciseIds({})).toBe(false)
    expect(detectLegacyExerciseIds({ days: "not-an-array" })).toBe(false)
  })
})

describe("LEGACY_MIGRATION_ERROR_MESSAGE", () => {
  it("contains the version string '0.3.0' so agents know which release introduced the break", () => {
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain("0.3.0")
  })

  it("shows the new bare-string shape as one of the migration paths", () => {
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"exercises": ["uuid-1", "uuid-2"]')
  })

  it("shows the new object form with the required prescription fields", () => {
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"sets": 4')
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"reps": "8"')
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"weight_kg": 80')
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain('"rest_seconds": 120')
  })

  it("points the agent at get_exercise_details for weight_convention guidance", () => {
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain("get_exercise_details")
    expect(LEGACY_MIGRATION_ERROR_MESSAGE).toContain("weight_convention")
  })
})

describe("parseExerciseInput — bare string form", () => {
  it("accepts a valid UUID and returns kind: 'bare'", () => {
    const result = parseExerciseInput(VALID_UUID, DAY, 0)
    expect(result).toEqual({
      ok: true,
      value: { kind: "bare", exerciseId: VALID_UUID },
    })
  })

  it("rejects a non-UUID string with a positional error", () => {
    const result = parseExerciseInput("not-a-uuid", DAY, 0)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[0]')
      expect(result.error).toContain("not-a-uuid")
    }
  })
})

describe("parseExerciseInput — object form (happy path)", () => {
  it("accepts a complete prescription with required fields and no target_duration_seconds", () => {
    const input = {
      exercise_id: VALID_UUID,
      sets: 4,
      reps: "8",
      weight_kg: 80,
      rest_seconds: 120,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "object",
        exerciseId: VALID_UUID,
        sets: 4,
        reps: "8",
        weightKg: 80,
        restSeconds: 120,
        targetDurationSeconds: null,
      },
    })
  })

  it("accepts a 'N-M' reps range (double progression)", () => {
    const input = {
      exercise_id: VALID_UUID,
      sets: 4,
      reps: "8-12",
      weight_kg: 80,
      rest_seconds: 120,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ reps: "8-12" })
    }
  })

  it("accepts an explicit target_duration_seconds — shape/bounds only; cross-field gating is layer 2", () => {
    // The reps="8" + target_duration_seconds combo will be REJECTED by
    // validateRepsModeCrossField on a reps exercise (T74's only cross-field
    // rule). The bounds layer just confirms it parses and lands in the bounds
    // window. T75 adds the symmetric duration-mode cross-field rules.
    const input = {
      exercise_id: VALID_UUID,
      sets: 4,
      reps: "8",
      weight_kg: 80,
      rest_seconds: 120,
      target_duration_seconds: 45,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ targetDurationSeconds: 45 })
    }
  })

  it("accepts target_duration_seconds === null as the same as omitted", () => {
    const input = {
      exercise_id: VALID_UUID,
      sets: 4,
      reps: "8",
      weight_kg: 80,
      rest_seconds: 120,
      target_duration_seconds: null,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ targetDurationSeconds: null })
    }
  })

  it("accepts fractional weight_kg (DB column is TEXT, fractional kgs are valid)", () => {
    const input = {
      exercise_id: VALID_UUID,
      sets: 3,
      reps: "10",
      weight_kg: 22.5,
      rest_seconds: 60,
    }
    const result = parseExerciseInput(input, DAY, 0)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ weightKg: 22.5 })
    }
  })
})

describe("parseExerciseInput — bounds and shape rejections", () => {
  function expectError(input: unknown, fragment: string) {
    const result = parseExerciseInput(input, DAY, 2)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[2]')
      expect(result.error).toContain(fragment)
    }
  }

  it("rejects null", () => {
    expectError(null, "must be a UUID string or a prescription object")
  })

  it("rejects an array", () => {
    expectError([VALID_UUID], "must be a UUID string or a prescription object")
  })

  it("rejects a number", () => {
    expectError(42, "must be a UUID string or a prescription object")
  })

  it("rejects an object missing exercise_id", () => {
    expectError({ sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120 }, "exercise_id")
  })

  it("rejects an object with non-UUID exercise_id", () => {
    expectError({ exercise_id: "garbage", sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120 }, "exercise_id")
  })

  it("rejects sets out of bounds (sets > 10)", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 11, reps: "8", weight_kg: 80, rest_seconds: 120 },
      ".sets",
    )
  })

  it("rejects sets out of bounds (sets < 1)", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 0, reps: "8", weight_kg: 80, rest_seconds: 120 },
      ".sets",
    )
  })

  it("rejects non-integer sets (e.g. 4.5)", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4.5, reps: "8", weight_kg: 80, rest_seconds: 120 },
      ".sets",
    )
  })

  it("rejects reps that don't match the regex (e.g. 'AMRAP')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "AMRAP", weight_kg: 80, rest_seconds: 120 },
      ".reps",
    )
  })

  it("rejects reps with trailing dash (e.g. '8-')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8-", weight_kg: 80, rest_seconds: 120 },
      ".reps",
    )
  })

  it("rejects reps with inverted range (e.g. '12-8')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "12-8", weight_kg: 80, rest_seconds: 120 },
      ".reps",
    )
  })

  it("rejects reps bounds out of [1, 50] (e.g. '51' or '50-60')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "51", weight_kg: 80, rest_seconds: 120 },
      "out of range",
    )
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "10-60", weight_kg: 80, rest_seconds: 120 },
      "out of range",
    )
  })

  it("rejects weight_kg out of [0, 500]", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: -5, rest_seconds: 120 },
      ".weight_kg",
    )
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: 501, rest_seconds: 120 },
      ".weight_kg",
    )
  })

  it("rejects rest_seconds out of [0, 600]", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: 80, rest_seconds: 601 },
      ".rest_seconds",
    )
  })

  it("rejects target_duration_seconds out of [5, 600]", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120, target_duration_seconds: 4 },
      ".target_duration_seconds",
    )
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "8", weight_kg: 80, rest_seconds: 120, target_duration_seconds: 601 },
      ".target_duration_seconds",
    )
  })
})

describe("validateRepsModeCrossField", () => {
  function makeObject(overrides: Partial<{ targetDurationSeconds: number | null }> = {}) {
    return {
      kind: "object" as const,
      exerciseId: VALID_UUID,
      sets: 4,
      reps: "8",
      weightKg: 80,
      restSeconds: 120,
      targetDurationSeconds: null as number | null,
      ...overrides,
    }
  }

  it("passes a bare-string parsed exercise (no fields to cross-check)", () => {
    const result = validateRepsModeCrossField(
      { kind: "bare", exerciseId: VALID_UUID_2 },
      { name: "Bench", measurement_type: "reps" },
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("passes an object form with no target_duration_seconds on a reps exercise", () => {
    const result = validateRepsModeCrossField(
      makeObject({ targetDurationSeconds: null }),
      { name: "Bench", measurement_type: "reps" },
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("REJECTS an object form with target_duration_seconds on a reps exercise (T74's only cross-field rule)", () => {
    const result = validateRepsModeCrossField(
      makeObject({ targetDurationSeconds: 30 }),
      { name: "Bench Press", measurement_type: "reps" },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[0]')
      expect(result.error).toContain("Bench Press")
      expect(result.error).toContain("target_duration_seconds")
    }
  })

  it("passes an object form with target_duration_seconds on a duration exercise (T75 owns the inverse rule)", () => {
    const result = validateRepsModeCrossField(
      makeObject({ targetDurationSeconds: 45 }),
      { name: "Plank", measurement_type: "duration" },
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })
})
