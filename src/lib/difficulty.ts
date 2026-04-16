import type { Exercise } from "@/types/database"

type DifficultyLevel = NonNullable<Exercise["difficulty_level"]>

const DIFFICULTY_CLASSES: Record<DifficultyLevel, string> = {
  beginner: "bg-green-600 text-white border-green-600",
  intermediate: "bg-yellow-500 text-black border-yellow-500",
  advanced: "bg-red-600 text-white border-red-600",
}

export function getDifficultyColor(level: DifficultyLevel): string {
  return DIFFICULTY_CLASSES[level] ?? ""
}
