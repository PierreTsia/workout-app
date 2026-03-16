const VOLUME_MAP: Record<number, { exerciseCount: number }> = {
  15: { exerciseCount: 4 },
  30: { exerciseCount: 5 },
  45: { exerciseCount: 7 },
  60: { exerciseCount: 9 },
  90: { exerciseCount: 13 },
}

const EQUIPMENT_CATEGORY_MAP: Record<string, string[]> = {
  bodyweight: ["bodyweight"],
  dumbbells: ["dumbbell"],
  "full-gym": [
    "barbell",
    "dumbbell",
    "ez_bar",
    "machine",
    "cable",
    "bench",
    "kettlebell",
    "band",
  ],
}

const MAX_CATALOG_SIZE = 120
const MAX_PER_GROUP = 15

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

export function getEquipmentValues(category: string): string[] {
  return EQUIPMENT_CATEGORY_MAP[category] ?? []
}

export function getTargetExerciseCount(duration: number): number {
  return VOLUME_MAP[duration]?.exerciseCount ?? 5
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

export function buildPrompt(
  catalog: CatalogExercise[],
  profile: UserProfile | null,
  recentExercises: RecentExercise[],
  constraints: {
    duration: number
    equipmentCategory: string
    muscleGroups: string[]
  },
): string {
  const targetCount = getTargetExerciseCount(constraints.duration)
  const isFullBody =
    constraints.muscleGroups.length === 0 ||
    constraints.muscleGroups.includes("full-body")

  const lines: string[] = []

  lines.push(
    "You are a workout programming assistant. You select exercises from a provided catalog to build a workout.",
    "",
    "RULES:",
    "- Return ONLY exercise IDs from the EXERCISE CATALOG below. Never invent IDs.",
    `- Select exactly ${targetCount} exercises.`,
    "- Respect the user's equipment and muscle group constraints.",
    "- Order exercises: compound movements (those with secondary_muscles) first, isolation movements last.",
    "- Avoid exercises the user did in their last 5 sessions (listed below) unless the pool is too small.",
    "- Group synergistic muscles (e.g., chest + triceps, back + biceps) when the focus allows.",
    "- For full-body workouts, distribute exercises evenly across major muscle groups.",
  )

  if (profile) {
    lines.push(
      `- Given the user's experience level (${profile.experience}), prefer exercises matching or slightly above their difficulty level — this supports progressive overload.`,
      "",
      "USER PROFILE:",
      `- Experience: ${profile.experience}`,
      `- Goal: ${profile.goal}`,
      `- Equipment preference: ${profile.equipment}`,
      `- Training days/week: ${profile.training_days_per_week}`,
    )
    if (profile.age != null) {
      lines.push(`- Age: ${profile.age}`)
    }
    if (profile.gender && profile.gender !== "prefer_not_to_say") {
      lines.push(`- Gender: ${profile.gender}`)
    }
  }

  if (recentExercises.length > 0) {
    lines.push("", "RECENT EXERCISES (avoid if possible):")
    for (const ex of recentExercises) {
      lines.push(`- ${ex.exercise_id} (${ex.exercise_name_snapshot})`)
    }
  }

  const focusLabel = isFullBody
    ? "Full Body"
    : constraints.muscleGroups.join(", ")

  lines.push(
    "",
    "CONSTRAINTS:",
    `- Duration: ${constraints.duration} minutes`,
    `- Equipment: ${constraints.equipmentCategory}`,
    `- Focus: ${focusLabel}`,
    `- Target exercise count: ${targetCount}`,
    "",
    "EXERCISE CATALOG:",
    serializeCatalog(catalog),
  )

  return lines.join("\n")
}
