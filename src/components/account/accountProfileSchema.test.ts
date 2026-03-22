import { describe, it, expect, vi } from "vitest"
import { accountProfileSchema } from "./accountProfileSchema"

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}))

const BASE = {
  gender: "male" as const,
  goal: "strength" as const,
  experience: "intermediate" as const,
  equipment: "gym" as const,
  training_days_per_week: 4,
  session_duration_minutes: "60" as const,
  age: "30",
  weight: "80",
}

function parse(display_name: string) {
  return accountProfileSchema.safeParse({ ...BASE, display_name })
}

describe("accountProfileSchema — display_name", () => {
  it("rejects an empty string", () => {
    const result = parse("")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("DISPLAY_NAME_MIN_LEN")
    }
  })

  it("rejects 1 character", () => {
    const result = parse("x")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("DISPLAY_NAME_MIN_LEN")
    }
  })

  it("rejects 4 characters", () => {
    const result = parse("abcd")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("DISPLAY_NAME_MIN_LEN")
    }
  })

  it("accepts exactly 5 characters", () => {
    expect(parse("hello").success).toBe(true)
  })

  it("accepts 80 characters", () => {
    expect(parse("a".repeat(80)).success).toBe(true)
  })

  it("rejects 81 characters", () => {
    const result = parse("a".repeat(81))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("DISPLAY_NAME_MAX_LEN")
    }
  })
})
