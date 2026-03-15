import { describe, it, expect } from "vitest"
import { deriveEquipmentContexts } from "@/lib/deriveEquipmentContexts"
import type { ProgramTemplate, ExerciseAlternative } from "@/types/onboarding"

function makeTemplate(exercises: { id: string; equipment: string }[]): ProgramTemplate {
  return {
    id: "tpl-1",
    name: "Test",
    description: null,
    min_days: 3,
    max_days: 5,
    primary_goal: "hypertrophy",
    experience_tags: ["beginner"],
    template_days: [
      {
        id: "day-1",
        template_id: "tpl-1",
        day_label: "Day 1",
        day_number: 1,
        muscle_focus: null,
        sort_order: 0,
        template_exercises: exercises.map((ex, i) => ({
          id: `te-${i}`,
          template_day_id: "day-1",
          exercise_id: ex.id,
          sets: 3,
          rep_range: "8-12",
          rest_seconds: 90,
          sort_order: i,
          exercise: { id: ex.id, name: "Ex", muscle_group: "", emoji: "", is_system: true, created_at: "", youtube_url: null, instructions: null, image_url: null, equipment: ex.equipment, difficulty_level: null, name_en: null, source: null, secondary_muscles: null, reviewed_at: null, reviewed_by: null },
        })),
      },
    ],
  }
}

describe("deriveEquipmentContexts", () => {
  it("always includes gym", () => {
    const tpl = makeTemplate([{ id: "e1", equipment: "barbell" }])
    const result = deriveEquipmentContexts(tpl, [])
    expect(result).toContain("gym")
  })

  it("includes home/minimal when all exercises are bodyweight", () => {
    const tpl = makeTemplate([
      { id: "e1", equipment: "bodyweight" },
      { id: "e2", equipment: "none" },
    ])
    const result = deriveEquipmentContexts(tpl, [])
    expect(result).toEqual(expect.arrayContaining(["gym", "home", "minimal"]))
  })

  it("includes a context when alternatives cover all non-bodyweight exercises", () => {
    const tpl = makeTemplate([
      { id: "e1", equipment: "barbell" },
      { id: "e2", equipment: "bodyweight" },
    ])
    const alternatives: ExerciseAlternative[] = [
      { exercise_id: "e1", alternative_exercise_id: "e1-home", equipment_context: "home" },
    ]
    const result = deriveEquipmentContexts(tpl, alternatives)
    expect(result).toContain("home")
    expect(result).not.toContain("minimal")
  })

  it("excludes a context when some exercises have no alternative", () => {
    const tpl = makeTemplate([
      { id: "e1", equipment: "barbell" },
      { id: "e2", equipment: "cable" },
    ])
    const alternatives: ExerciseAlternative[] = [
      { exercise_id: "e1", alternative_exercise_id: "e1-home", equipment_context: "home" },
    ]
    const result = deriveEquipmentContexts(tpl, alternatives)
    expect(result).toEqual(["gym"])
  })

  it("treats 'body weight' (with space) as bodyweight", () => {
    const tpl = makeTemplate([{ id: "e1", equipment: "Body Weight" }])
    const result = deriveEquipmentContexts(tpl, [])
    expect(result).toEqual(expect.arrayContaining(["gym", "home", "minimal"]))
  })

  it("returns all contexts for an empty template (vacuously true)", () => {
    const tpl = makeTemplate([])
    const result = deriveEquipmentContexts(tpl, [])
    expect(result).toEqual(["gym", "home", "minimal"])
  })
})
