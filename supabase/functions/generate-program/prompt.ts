const EQUIPMENT_CATEGORY_MAP: Record<string, string[]> = {
  bodyweight: ["bodyweight"],
  dumbbells: ["dumbbell"],
  "full-gym": [
    "barbell", "dumbbell", "ez_bar", "machine", "cable", "bench", "kettlebell", "band",
  ],
}

const MAX_CATALOG_SIZE = 120
const MAX_PER_GROUP = 15

const VOLUME_MAP: Record<number, number> = {
  15: 4, 30: 5, 45: 7, 60: 9, 90: 13,
}

export interface CatalogExercise {
  id: string
  name_en: string | null
  muscle_group: string
  equipment: string
  secondary_muscles: string[] | null
  difficulty_level: string | null
}

export interface UserProfile {
  experience: string
  goal: string
  equipment: string
  training_days_per_week: number
  age: number | null
  gender: string | null
}

export interface RecentExercise {
  exercise_id: string
  exercise_name_snapshot: string
}

export interface ProgramConstraints {
  daysPerWeek: number
  duration: number
  equipmentCategory: string
  goal: string
  experience: string
  focusAreas?: string
  splitPreference?: string
}

export function getEquipmentValues(category: string): string[] {
  return EQUIPMENT_CATEGORY_MAP[category] ?? []
}

export function getExerciseBounds(duration: number): { min: number; max: number } {
  const base = VOLUME_MAP[duration] ?? 7
  return { min: Math.max(4, base - 2), max: Math.min(13, base + 2) }
}

export function capCatalog(exercises: CatalogExercise[]): CatalogExercise[] {
  if (exercises.length <= MAX_CATALOG_SIZE) return exercises

  const byGroup = new Map<string, CatalogExercise[]>()
  for (const ex of exercises) {
    const list = byGroup.get(ex.muscle_group) ?? []
    list.push(ex)
    byGroup.set(ex.muscle_group, list)
  }

  const capped: CatalogExercise[] = []
  for (const [, groupExercises] of byGroup) {
    const shuffled = groupExercises.sort(() => Math.random() - 0.5)
    capped.push(...shuffled.slice(0, MAX_PER_GROUP))
  }
  return capped
}

function serializeCatalog(exercises: CatalogExercise[]): string {
  return JSON.stringify(
    exercises.map((e) => ({
      id: e.id,
      n: e.name_en ?? e.muscle_group,
      mg: e.muscle_group,
      eq: e.equipment,
      sm: e.secondary_muscles ?? [],
      dl: e.difficulty_level ?? "unknown",
    })),
  )
}

export function buildProgramPrompt(
  catalog: CatalogExercise[],
  profile: UserProfile | null,
  recentExercises: RecentExercise[],
  constraints: ProgramConstraints,
  trainingGap: boolean,
): string {
  const bounds = getExerciseBounds(constraints.duration)
  const lines: string[] = []

  lines.push(
    "You are a strength and conditioning coach designing a multi-day training program.",
    "",
    "RULES:",
    `- Design a training split for ${constraints.daysPerWeek} days per week.`,
    `- Each day should have between ${bounds.min} and ${bounds.max} exercises.`,
    "- Return ONLY exercise IDs from the EXERCISE CATALOG below. Never invent IDs.",
    "- No duplicate exercises across any days.",
    "- Order exercises within each day: compound movements (those with secondary_muscles) first, isolation last.",
    "- Group synergistic muscles on the same day (e.g. chest + triceps, back + biceps).",
    "- Distribute muscle groups across the week so no group is overtrained.",
    "- Provide a brief rationale (1-2 sentences) explaining why this split suits the user.",
    `- Given the user's experience level (${constraints.experience}), prefer exercises whose difficulty_level matches or is one step above.`,
  )

  if (constraints.splitPreference && constraints.splitPreference !== "auto") {
    lines.push(`- The user prefers a ${constraints.splitPreference} split.`)
  }
  if (constraints.focusAreas) {
    lines.push(`- The user wants to emphasize: ${constraints.focusAreas}.`)
  }
  if (trainingGap) {
    lines.push(
      "- The user hasn't trained in over 2 weeks. Propose a conservative re-entry program: prefer compound movements, standard volume, moderate intensity.",
    )
  }

  lines.push(
    "",
    "USER PROFILE:",
    `- Experience: ${constraints.experience}`,
    `- Goal: ${constraints.goal}`,
    `- Equipment: ${constraints.equipmentCategory}`,
    `- Session duration: ${constraints.duration} minutes`,
  )

  if (profile?.age != null) lines.push(`- Age: ${profile.age}`)
  if (profile?.gender && profile.gender !== "prefer_not_to_say") {
    lines.push(`- Gender: ${profile.gender}`)
  }

  if (recentExercises.length > 0) {
    lines.push("", "RECENT EXERCISES (prefer variety over these):")
    for (const ex of recentExercises) {
      lines.push(`- ${ex.exercise_id} (${ex.exercise_name_snapshot})`)
    }
  }

  lines.push("", "EXERCISE CATALOG:", serializeCatalog(catalog))

  return lines.join("\n")
}
