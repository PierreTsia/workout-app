import type { Exercise } from "@/types/database"

export interface LlmPromptConstraints {
  muscle_groups: string[]
  equipment: string[]
  difficulty_levels: string[]
}

export function buildLlmReviewPrompt(
  exercise: Exercise,
  constraints?: LlmPromptConstraints,
): string {
  const payload = {
    name: exercise.name,
    name_en: exercise.name_en,
    muscle_group: exercise.muscle_group,
    secondary_muscles: exercise.secondary_muscles,
    equipment: exercise.equipment,
    emoji: exercise.emoji,
    instructions: exercise.instructions,
    youtube_url: exercise.youtube_url,
    image_url: exercise.image_url,
    source: exercise.source,
    difficulty_level: exercise.difficulty_level ?? null,
    measurement_type: exercise.measurement_type ?? "reps",
    default_duration_seconds: exercise.default_duration_seconds ?? null,
  }

  const constraintBlock = constraints
    ? `

CONTRAINTES IMPORTANTES — utilise UNIQUEMENT ces valeurs :
- muscle_group : ${JSON.stringify(constraints.muscle_groups)}
- equipment : ${JSON.stringify(constraints.equipment)}
- difficulty_level : ${JSON.stringify(constraints.difficulty_levels)}
- measurement_type : ["reps", "duration"]
- secondary_muscles : sous-ensemble de muscle_group ci-dessus`
    : ""

  return `En tant qu'expert coach sportif et préparateur physique, vérifie et corrige si nécessaire les informations suivantes sur cet exercice. Réponds UNIQUEMENT avec le JSON corrigé (mêmes clés, même structure) :${constraintBlock}

${JSON.stringify(payload, null, 2)}`
}
