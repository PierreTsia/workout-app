import { describe, it, expect } from "vitest"
import { questionnaireSchema, toQuestionnaireOutput } from "./schema"
import type { QuestionnaireValues } from "./schema"

const VALID_INPUT: QuestionnaireValues = {
  gender: "male",
  goal: "hypertrophy",
  experience: "intermediate",
  equipment: "gym",
  training_days_per_week: 4,
  session_duration_minutes: "60",
  age: "28",
  weight: "80",
}

describe("questionnaireSchema", () => {
  it("accepts valid input", () => {
    const result = questionnaireSchema.safeParse(VALID_INPUT)
    expect(result.success).toBe(true)
  })

  describe("required enums", () => {
    it.each(["gender", "goal", "experience", "equipment"] as const)(
      "rejects missing %s",
      (field) => {
        const result = questionnaireSchema.safeParse({ ...VALID_INPUT, [field]: undefined })
        expect(result.success).toBe(false)
      },
    )

    it("rejects invalid gender value", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, gender: "nonbinary" })
      expect(result.success).toBe(false)
    })
  })

  describe("age", () => {
    it("rejects empty string", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, age: "" })
      expect(result.success).toBe(false)
    })

    it("rejects non-numeric string", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, age: "abc" })
      expect(result.success).toBe(false)
    })

    it("rejects decimal", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, age: "28.5" })
      expect(result.success).toBe(false)
    })

    it("accepts whole number string", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, age: "45" })
      expect(result.success).toBe(true)
    })
  })

  describe("weight", () => {
    it("rejects empty string", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, weight: "" })
      expect(result.success).toBe(false)
    })

    it("rejects non-numeric string", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, weight: "heavy" })
      expect(result.success).toBe(false)
    })

    it("accepts decimal", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, weight: "75.5" })
      expect(result.success).toBe(true)
    })

    it("accepts whole number string", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, weight: "80" })
      expect(result.success).toBe(true)
    })
  })

  describe("training_days_per_week", () => {
    it("rejects below min (1)", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, training_days_per_week: 1 })
      expect(result.success).toBe(false)
    })

    it("rejects above max (7)", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, training_days_per_week: 7 })
      expect(result.success).toBe(false)
    })

    it("accepts boundary values (2 and 6)", () => {
      expect(questionnaireSchema.safeParse({ ...VALID_INPUT, training_days_per_week: 2 }).success).toBe(true)
      expect(questionnaireSchema.safeParse({ ...VALID_INPUT, training_days_per_week: 6 }).success).toBe(true)
    })
  })

  describe("session_duration_minutes", () => {
    it("rejects invalid option", () => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, session_duration_minutes: "120" })
      expect(result.success).toBe(false)
    })

    it.each(["30", "45", "60", "90"] as const)("accepts %s", (val) => {
      const result = questionnaireSchema.safeParse({ ...VALID_INPUT, session_duration_minutes: val })
      expect(result.success).toBe(true)
    })
  })
})

describe("toQuestionnaireOutput", () => {
  it("converts string fields to numbers", () => {
    const output = toQuestionnaireOutput(VALID_INPUT)
    expect(output.age).toBe(28)
    expect(output.weight).toBe(80)
    expect(output.session_duration_minutes).toBe(60)
    expect(typeof output.age).toBe("number")
    expect(typeof output.weight).toBe("number")
    expect(typeof output.session_duration_minutes).toBe("number")
  })

  it("passes enum fields through unchanged", () => {
    const output = toQuestionnaireOutput(VALID_INPUT)
    expect(output.gender).toBe("male")
    expect(output.goal).toBe("hypertrophy")
    expect(output.experience).toBe("intermediate")
    expect(output.equipment).toBe("gym")
  })

  it("preserves training_days_per_week as number", () => {
    const output = toQuestionnaireOutput(VALID_INPUT)
    expect(output.training_days_per_week).toBe(4)
  })
})
