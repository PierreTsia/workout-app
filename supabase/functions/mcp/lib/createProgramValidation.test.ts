import { describe, expect, it } from "vitest"
import {
  detectLegacyExerciseIds,
  LEGACY_MIGRATION_ERROR_MESSAGE,
  parseExerciseInput,
  validateExerciseCrossFields,
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

  it("rejects reps bounds out of [0, 50] (e.g. '51' or '50-60')", () => {
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "51", weight_kg: 80, rest_seconds: 120 },
      "out of range",
    )
    expectError(
      { exercise_id: VALID_UUID, sets: 4, reps: "10-60", weight_kg: 80, rest_seconds: 120 },
      "out of range",
    )
  })

  it("accepts reps '0' at the bounds layer (sentinel for duration mode; cross-field R6 enforces semantics)", () => {
    const result = parseExerciseInput(
      { exercise_id: VALID_UUID, sets: 3, reps: "0", weight_kg: 0, rest_seconds: 60, target_duration_seconds: 45 },
      "Day 1",
      0,
    )
    expect(result.ok).toBe(true)
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

describe("validateExerciseCrossFields (T75 superset; T74 rule R4 still covered)", () => {
  type ObjectOverrides = Partial<{
    targetDurationSeconds: number | null
    weightKg: number
    reps: string
  }>

  function makeObject(overrides: ObjectOverrides = {}) {
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

  const REPS_BARBELL = { name: "Bench Press", equipment: "barbell", measurement_type: "reps" as const }
  const REPS_DUMBBELL = { name: "DB Curl", equipment: "dumbbell", measurement_type: "reps" as const }
  const REPS_BODYWEIGHT = { name: "Pushup", equipment: "bodyweight", measurement_type: "reps" as const }
  const DURATION_BODYWEIGHT = { name: "Plank", equipment: "bodyweight", measurement_type: "duration" as const }

  it("passes a bare-string parsed exercise (no fields to cross-check)", () => {
    const result = validateExerciseCrossFields(
      { kind: "bare", exerciseId: VALID_UUID_2 },
      REPS_BARBELL,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("passes a complete reps prescription on a barbell exercise (happy path)", () => {
    const result = validateExerciseCrossFields(makeObject(), REPS_BARBELL, DAY, 0)
    expect(result.ok).toBe(true)
  })

  it("passes a duration prescription with target_duration_seconds on a duration exercise (happy path)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 0, targetDurationSeconds: 45 }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("R1: REJECTS bodyweight + weight_kg > 0 and references issue #281", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "12", weightKg: 50 }),
      REPS_BODYWEIGHT,
      DAY,
      1,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('days["Push"].exercises[1]')
      expect(result.error).toContain("Pushup")
      expect(result.error).toContain("weight_kg")
      expect(result.error).toContain("#281")
    }
  })

  it("R1: passes bodyweight + weight_kg === 0 (the only legal weight on bodyweight)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "12", weightKg: 0 }),
      REPS_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("R2: REJECTS duration exercise with non-'0' reps (e.g. reps='8')", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "8", weightKg: 0, targetDurationSeconds: 45 }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Plank")
      expect(result.error).toContain('reps "8"')
    }
  })

  it("R3: REJECTS duration exercise with weight_kg > 0", () => {
    // Use a non-bodyweight equipment so R1 doesn't fire first.
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 10, targetDurationSeconds: 45 }),
      { name: "Weighted Hang", equipment: "barbell", measurement_type: "duration" },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Weighted Hang")
      expect(result.error).toContain("weight_kg")
      expect(result.error).toContain("v0.3.0")
    }
  })

  it("R4 (T74): REJECTS reps exercise with target_duration_seconds set (still enforced by the T75 superset)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ targetDurationSeconds: 30 }),
      REPS_DUMBBELL,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("DB Curl")
      expect(result.error).toContain("target_duration_seconds")
    }
  })

  it("R5: REJECTS duration exercise object form WITHOUT target_duration_seconds and points at the bare-UUID escape hatch", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 0, targetDurationSeconds: null }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Plank")
      expect(result.error).toContain("requires target_duration_seconds")
      expect(result.error).toContain("bare UUID")
    }
  })

  it("R5: passes a duration exercise as a bare UUID even though no target_duration_seconds is set", () => {
    const result = validateExerciseCrossFields(
      { kind: "bare", exerciseId: VALID_UUID },
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("R6: REJECTS a non-duration (reps) exercise that passes reps \"0\" — sentinel reserved for duration mode", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 80, targetDurationSeconds: null }),
      REPS_BARBELL,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Bench Press")
      expect(result.error).toContain('reps "0"')
      expect(result.error).toContain("reserved for duration")
    }
  })

  it("R6: REJECTS reps \"0\" even on a bodyweight reps exercise (no equipment exemption)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 0, targetDurationSeconds: null }),
      REPS_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Pushup")
      expect(result.error).toContain('reps "0"')
    }
  })

  it("R6: ACCEPTS reps \"0\" on a duration exercise (the supported pairing with target_duration_seconds)", () => {
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 0, targetDurationSeconds: 45 }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(true)
  })

  it("rule order: R1 fires BEFORE R3 (bodyweight error wins over duration error)", () => {
    // Bodyweight + duration + weight > 0 → both R1 and R3 would match, but R1
    // is more specific and points at #281; R3 is the generic duration message.
    const result = validateExerciseCrossFields(
      makeObject({ reps: "0", weightKg: 50, targetDurationSeconds: 45 }),
      DURATION_BODYWEIGHT,
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("#281")
    }
  })
})

describe("validateRepsModeCrossField (deprecated T74 shim — backwards compatibility)", () => {
  it("forwards to validateExerciseCrossFields and still rejects R4 violations", () => {
    const result = validateRepsModeCrossField(
      {
        kind: "object",
        exerciseId: VALID_UUID,
        sets: 4,
        reps: "8",
        weightKg: 80,
        restSeconds: 120,
        targetDurationSeconds: 30,
      },
      { name: "Bench Press", measurement_type: "reps" },
      DAY,
      0,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("Bench Press")
      expect(result.error).toContain("target_duration_seconds")
    }
  })
})
