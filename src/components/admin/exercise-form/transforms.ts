import type { Exercise } from "@/types/database"
import type { ExerciseFormValues } from "./schema"

export function toFormValues(exercise: Exercise): ExerciseFormValues {
  const ins = exercise.instructions
  return {
    name: exercise.name,
    name_en: exercise.name_en ?? "",
    muscle_group: exercise.muscle_group,
    equipment: exercise.equipment ?? "",
    emoji: exercise.emoji,
    secondary_muscles: (exercise.secondary_muscles ?? []).join(", "),
    youtube_url: exercise.youtube_url ?? "",
    image_url: exercise.image_url ?? "",
    instructions: {
      setup: (ins?.setup ?? []).map((v) => ({ value: v })),
      movement: (ins?.movement ?? []).map((v) => ({ value: v })),
      breathing: (ins?.breathing ?? []).map((v) => ({ value: v })),
      common_mistakes: (ins?.common_mistakes ?? []).map((v) => ({ value: v })),
    },
  }
}

export function fromFormValues(values: ExerciseFormValues) {
  return {
    name: values.name,
    name_en: values.name_en || null,
    muscle_group: values.muscle_group,
    equipment: values.equipment,
    emoji: values.emoji,
    secondary_muscles: values.secondary_muscles
      ? values.secondary_muscles.split(",").map((s) => s.trim()).filter(Boolean)
      : null,
    youtube_url: values.youtube_url || null,
    image_url: values.image_url || null,
    instructions: {
      setup: values.instructions.setup
        .map((s) => s.value.trim())
        .filter(Boolean),
      movement: values.instructions.movement
        .map((s) => s.value.trim())
        .filter(Boolean),
      breathing: values.instructions.breathing
        .map((s) => s.value.trim())
        .filter(Boolean),
      common_mistakes: values.instructions.common_mistakes
        .map((s) => s.value.trim())
        .filter(Boolean),
    },
  }
}
