import type { Exercise, ExerciseInstructions } from "@/types/database"
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
    source: exercise.source ?? "",
    difficulty_level: exercise.difficulty_level ?? "",
    measurement_type: exercise.measurement_type ?? "reps",
    default_duration_seconds: exercise.default_duration_seconds ?? null,
    instructions: {
      setup: (ins?.setup ?? []).map((v) => ({ value: v })),
      movement: (ins?.movement ?? []).map((v) => ({ value: v })),
      breathing: (ins?.breathing ?? []).map((v) => ({ value: v })),
      common_mistakes: (ins?.common_mistakes ?? []).map((v) => ({ value: v })),
    },
  }
}

const toSteps = (arr: unknown) =>
  Array.isArray(arr) ? arr.map((v) => ({ value: String(v) })) : []

/**
 * Parse raw JSON (typically from an LLM response) into form-compatible values.
 * Only keys that exist and are non-null in the input are included, so the
 * result can be spread over existing form values without clobbering untouched fields.
 */
export function fromLlmJson(
  raw: Record<string, unknown>,
): Partial<ExerciseFormValues> {
  const result: Partial<ExerciseFormValues> = {}

  if (raw.name != null) result.name = String(raw.name)
  if (raw.name_en != null) result.name_en = String(raw.name_en)
  if (raw.muscle_group != null) result.muscle_group = String(raw.muscle_group)
  if (raw.equipment != null) result.equipment = String(raw.equipment)
  if (raw.emoji != null) result.emoji = String(raw.emoji)

  if (raw.secondary_muscles != null) {
    result.secondary_muscles = Array.isArray(raw.secondary_muscles)
      ? raw.secondary_muscles.join(", ")
      : String(raw.secondary_muscles)
  }

  if (raw.youtube_url != null) result.youtube_url = String(raw.youtube_url)
  if (raw.image_url != null) result.image_url = String(raw.image_url)
  if (raw.source != null) result.source = String(raw.source)

  if (raw.difficulty_level != null) {
    const dl = String(raw.difficulty_level)
    result.difficulty_level =
      dl === "beginner" || dl === "intermediate" || dl === "advanced" ? dl : ""
  }

  if (raw.measurement_type != null) {
    const mt = String(raw.measurement_type)
    result.measurement_type = mt === "duration" ? "duration" : "reps"
  }

  if (raw.default_duration_seconds != null) {
    const n = Number(raw.default_duration_seconds)
    result.default_duration_seconds = Number.isFinite(n) && n > 0 ? n : null
  }

  const ins = raw.instructions as Partial<ExerciseInstructions> | undefined
  if (ins && typeof ins === "object") {
    result.instructions = {
      setup: toSteps(ins.setup),
      movement: toSteps(ins.movement),
      breathing: toSteps(ins.breathing),
      common_mistakes: toSteps(ins.common_mistakes),
    }
  }

  return result
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
    source: values.source || null,
    difficulty_level: values.difficulty_level || null,
    measurement_type: values.measurement_type,
    default_duration_seconds:
      values.measurement_type === "duration"
        ? (values.default_duration_seconds ?? null)
        : null,
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
