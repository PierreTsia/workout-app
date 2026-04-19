import { describe, it, expect } from "vitest"
import { rankTemplates } from "./recommendTemplates"
import type { ProgramTemplate, UserProfile } from "@/types/onboarding"

function makeTemplate(
  overrides: Partial<ProgramTemplate> & Pick<ProgramTemplate, "name">,
): ProgramTemplate {
  return {
    id: overrides.name,
    description: null,
    min_days: 3,
    max_days: 4,
    primary_goal: "general_fitness",
    experience_tags: ["beginner"],
    template_days: [],
    ...overrides,
  }
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: "u1",
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
    timezone: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  }
}

const templates: ProgramTemplate[] = [
  makeTemplate({ name: "Full Body", min_days: 2, max_days: 4, primary_goal: "general_fitness", experience_tags: ["beginner"] }),
  makeTemplate({ name: "Upper/Lower", min_days: 3, max_days: 4, primary_goal: "hypertrophy", experience_tags: ["intermediate"] }),
  makeTemplate({ name: "PPL (Push/Pull/Legs)", min_days: 3, max_days: 6, primary_goal: "hypertrophy", experience_tags: ["intermediate", "advanced"] }),
  makeTemplate({ name: "GZCLP", min_days: 3, max_days: 4, primary_goal: "strength", experience_tags: ["beginner", "intermediate"] }),
  makeTemplate({ name: "Muscular Endurance", min_days: 3, max_days: 4, primary_goal: "endurance", experience_tags: ["beginner", "intermediate", "advanced"] }),
]

describe("rankTemplates", () => {
  it("ranks hypertrophy + 4 days → PPL and Upper/Lower highest", () => {
    const result = rankTemplates(templates, makeProfile({ goal: "hypertrophy", experience: "intermediate", training_days_per_week: 4 }))
    expect(result[0].name).toBe("PPL (Push/Pull/Legs)")
    expect(result[1].name).toBe("Upper/Lower")
    expect(result[0]).toBeDefined()
    expect(result[1]).toBeDefined()
  })

  it("ranks strength + 3 days → GZCLP first", () => {
    const result = rankTemplates(templates, makeProfile({ goal: "strength", experience: "intermediate", training_days_per_week: 3 }))
    expect(result[0].name).toBe("GZCLP")
  })

  it("returns only Full Body for 2 days/week", () => {
    const result = rankTemplates(templates, makeProfile({ training_days_per_week: 2 }))
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Full Body")
  })

  it("applies alphabetical tiebreak for same score", () => {
    const tied = [
      makeTemplate({ name: "Zeta", primary_goal: "hypertrophy", experience_tags: ["intermediate"] }),
      makeTemplate({ name: "Alpha", primary_goal: "hypertrophy", experience_tags: ["intermediate"] }),
    ]
    const result = rankTemplates(tied, makeProfile({ goal: "hypertrophy", experience: "intermediate", training_days_per_week: 3 }))
    expect(result[0].name).toBe("Alpha")
    expect(result[1].name).toBe("Zeta")
  })

  it("returns empty array when no templates match frequency", () => {
    const result = rankTemplates(templates, makeProfile({ training_days_per_week: 7 }))
    expect(result).toEqual([])
  })

  it("ranks endurance + beginner correctly", () => {
    const result = rankTemplates(templates, makeProfile({ goal: "endurance", experience: "beginner", training_days_per_week: 3 }))
    expect(result[0].name).toBe("Muscular Endurance")
  })
})
