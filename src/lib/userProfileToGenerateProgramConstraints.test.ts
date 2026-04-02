import { describe, it, expect } from "vitest"
import { userProfileToGenerateProgramConstraints } from "./userProfileToGenerateProgramConstraints"
import type { UserProfile } from "@/types/onboarding"

function baseProfile(over: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: "",
    display_name: null,
    avatar_url: null,
    gender: "male",
    age: 30,
    weight_kg: 80,
    goal: "hypertrophy",
    experience: "intermediate",
    equipment: "gym",
    training_days_per_week: 4,
    session_duration_minutes: 60,
    active_title_tier_id: null,
    created_at: "",
    updated_at: "",
    ...over,
  }
}

describe("userProfileToGenerateProgramConstraints", () => {
  it("maps gym equipment to full-gym and passes goal, experience, days, duration", () => {
    const c = userProfileToGenerateProgramConstraints(baseProfile(), "en")
    expect(c).toEqual({
      daysPerWeek: 4,
      duration: 60,
      equipmentCategory: "full-gym",
      goal: "hypertrophy",
      experience: "intermediate",
      focusAreas: undefined,
      splitPreference: undefined,
      locale: "en",
    })
  })

  it("maps home → dumbbells, minimal → bodyweight", () => {
    expect(
      userProfileToGenerateProgramConstraints(baseProfile({ equipment: "home" })).equipmentCategory,
    ).toBe("dumbbells")
    expect(
      userProfileToGenerateProgramConstraints(baseProfile({ equipment: "minimal" })).equipmentCategory,
    ).toBe("bodyweight")
  })

  it("clamps training days to 2–7", () => {
    expect(userProfileToGenerateProgramConstraints(baseProfile({ training_days_per_week: 1 })).daysPerWeek).toBe(
      2,
    )
    expect(userProfileToGenerateProgramConstraints(baseProfile({ training_days_per_week: 9 })).daysPerWeek).toBe(
      7,
    )
  })

  it("normalizes odd durations to nearest allowed slot", () => {
    expect(userProfileToGenerateProgramConstraints(baseProfile({ session_duration_minutes: 30 })).duration).toBe(
      30,
    )
    expect(userProfileToGenerateProgramConstraints(baseProfile({ session_duration_minutes: 100 })).duration).toBe(
      90,
    )
  })

  it("omits locale when not passed", () => {
    const c = userProfileToGenerateProgramConstraints(baseProfile())
    expect(c.locale).toBeUndefined()
  })
})
