import { describe, expect, it } from "vitest"
import { dayIntentToHeatmap } from "./dayIntentToHeatmap"
import { toIntentDayFromDayItems } from "./toIntentDayFromDayItems"
import type {
  BlockExerciseWithExercise,
  DayItem,
  Exercise,
  ExerciseBlockWithExercises,
  WorkoutExerciseWithExercise,
} from "@/types/database"

function makeCatalog(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    name: "Développé couché",
    name_en: "Bench Press",
    muscle_group: "Pectoraux",
    emoji: "💪",
    is_system: true,
    created_at: "1970-01-01T00:00:00Z",
    youtube_url: null,
    instructions: null,
    image_url: null,
    equipment: "barbell",
    difficulty_level: "intermediate",
    source: null,
    secondary_muscles: ["Triceps"],
    reviewed_at: null,
    reviewed_by: null,
    measurement_type: "reps",
    default_duration_seconds: null,
    ...overrides,
  }
}

function makeSolo(
  overrides: Partial<WorkoutExerciseWithExercise> = {},
): WorkoutExerciseWithExercise {
  return {
    id: "solo-1",
    workout_day_id: "day-1",
    exercise_id: "ex-1",
    name_snapshot: "Bench",
    muscle_snapshot: "Dos",
    emoji_snapshot: "💪",
    sets: 4,
    reps: "8-12",
    weight: "60",
    rest_seconds: 90,
    sort_order: 0,
    template_updated_at: "1970-01-01T00:00:00Z",
    exercise: makeCatalog(),
    ...overrides,
  }
}

function dayMeta() {
  return { id: "day-1", label: "Push", sortOrder: 0 }
}

function makeStation(
  overrides: Partial<BlockExerciseWithExercise> &
    Pick<BlockExerciseWithExercise, "id" | "exercise_id">,
): BlockExerciseWithExercise {
  return {
    block_id: "cindy",
    name_snapshot: "Station",
    muscle_snapshot: "Pectoraux",
    emoji_snapshot: "💪",
    position: 0,
    per_round: [{ amount: 5, weight: 0 }],
    exercise: makeCatalog(),
    ...overrides,
  }
}

function makeCindyBlock(): ExerciseBlockWithExercises {
  return {
    id: "cindy",
    workout_day_id: "day-1",
    label: "Cindy",
    rounds: 20,
    rest_seconds: 0,
    transition_seconds: 0,
    mode: "amrap",
    cap_seconds: 20 * 60,
    sort_order: 0,
    created_at: "1970-01-01T00:00:00Z",
    exercises: [
      makeStation({
        id: "st-pull",
        exercise_id: "ex-pull",
        name_snapshot: "Pull-up",
        muscle_snapshot: "Dos",
        position: 0,
        exercise: makeCatalog({
          id: "ex-pull",
          name: "Traction",
          name_en: "Pull-up",
          muscle_group: "Dos",
          secondary_muscles: ["Biceps"],
          equipment: "bodyweight",
        }),
      }),
      makeStation({
        id: "st-push",
        exercise_id: "ex-push",
        name_snapshot: "Push-up",
        muscle_snapshot: "Pectoraux",
        position: 1,
        exercise: makeCatalog({
          id: "ex-push",
          name: "Pompe",
          name_en: "Push-up",
          muscle_group: "Pectoraux",
          secondary_muscles: ["Triceps", "Épaules"],
          equipment: "bodyweight",
        }),
      }),
      makeStation({
        id: "st-squat",
        exercise_id: "ex-squat",
        name_snapshot: "Squat",
        muscle_snapshot: "Quadriceps",
        position: 2,
        exercise: makeCatalog({
          id: "ex-squat",
          name: "Squat",
          name_en: "Squat",
          muscle_group: "Quadriceps",
          secondary_muscles: ["Fessiers"],
          equipment: "bodyweight",
        }),
      }),
    ],
  }
}

describe("toIntentDayFromDayItems", () => {
  it("lets live catalog secondary_muscles win over the snapshot", () => {
    const items: DayItem[] = [
      {
        kind: "solo",
        sort_order: 0,
        exercise: makeSolo({
          muscle_snapshot: "Dos",
          exercise: makeCatalog({
            muscle_group: "Pectoraux",
            secondary_muscles: ["Triceps", "Épaules"],
          }),
        }),
      },
    ]

    const day = toIntentDayFromDayItems(dayMeta(), items)

    expect(day.solos[0]?.primaryMuscle).toBe("Pectoraux")
    expect(day.solos[0]?.secondaryMuscles).toEqual(["Triceps", "Épaules"])
  })

  it("drops unknown muscle slugs instead of inventing an axis", () => {
    const items: DayItem[] = [
      {
        kind: "solo",
        sort_order: 0,
        exercise: makeSolo({
          muscle_snapshot: "chest",
          exercise: makeCatalog({
            muscle_group: "chest",
            secondary_muscles: ["rear delt"],
          }),
        }),
      },
    ]

    const day = toIntentDayFromDayItems(dayMeta(), items)

    expect(day.solos[0]?.primaryMuscle).toBeNull()
    expect(day.solos[0]?.secondaryMuscles).toEqual([])
  })

  it("maps a Cindy block with 20 rounds as station presence — never rounds ×", () => {
    const items: DayItem[] = [
      { kind: "block", sort_order: 0, block: makeCindyBlock() },
    ]

    const day = toIntentDayFromDayItems(
      { id: "cindy", label: "Cindy", sortOrder: 0 },
      items,
    )
    const pec = dayIntentToHeatmap(day).chips.find(
      (chip) => chip.muscle === "Pectoraux",
    )

    expect(day.circuits[0]?.stations).toHaveLength(3)
    expect(pec?.credit).toBe(1)
    expect(pec?.credit).not.toBe(20)
  })
})
