import {
  EQUIPMENT_MAP,
  MUSCLE_GROUP_MAP,
  CATEGORY_FALLBACK_MAP,
  MUSCLE_EMOJI_MAP,
} from "./exercise-mapping.js"

export interface WgerTranslation {
  name: string
  language: number
  description: string
}

export interface WgerExerciseInfo {
  id: number
  category: { id: number; name: string }
  muscles: { id: number; name: string }[]
  muscles_secondary: { id: number; name: string }[]
  equipment: { id: number; name: string }[]
  translations: WgerTranslation[]
}

export function normalizeEquipment(wgerEquipmentIds: number[]): string {
  if (wgerEquipmentIds.length === 0) return "bodyweight"
  for (const id of wgerEquipmentIds) {
    const mapped = EQUIPMENT_MAP[id]
    if (mapped && mapped !== "bodyweight" && mapped !== "other") return mapped
  }
  return EQUIPMENT_MAP[wgerEquipmentIds[0]] ?? "other"
}

export function resolveMuscleGroup(
  wgerMuscleIds: number[],
  wgerCategoryId: number,
): string | null {
  for (const id of wgerMuscleIds) {
    const mapped = MUSCLE_GROUP_MAP[id]
    if (mapped) return mapped
  }
  return CATEGORY_FALLBACK_MAP[wgerCategoryId] ?? null
}

export function extractTranslation(
  translations: WgerTranslation[],
  languageId: number,
): WgerTranslation | undefined {
  return translations.find((t) => t.language === languageId)
}

export function buildExerciseRecord(
  info: WgerExerciseInfo,
  frenchName: string,
  englishName: string,
) {
  const muscleGroup = resolveMuscleGroup(
    info.muscles.map((m) => m.id),
    info.category.id,
  )
  if (!muscleGroup) return null

  const equipment = normalizeEquipment(info.equipment.map((e) => e.id))
  const emoji = MUSCLE_EMOJI_MAP[muscleGroup] ?? "🏋️"
  const secondaryMuscles = info.muscles_secondary.length > 0
    ? info.muscles_secondary.map((m) => MUSCLE_GROUP_MAP[m.id] ?? m.name).filter(Boolean)
    : null

  return {
    name: frenchName,
    name_en: englishName,
    muscle_group: muscleGroup,
    equipment,
    emoji,
    is_system: false,
    source: `wger:${info.id}`,
    secondary_muscles: secondaryMuscles,
  }
}

export function mergeWithExisting(
  wgerInfo: WgerExerciseInfo,
  englishName: string,
) {
  const equipment = normalizeEquipment(wgerInfo.equipment.map((e) => e.id))
  const secondaryMuscles = wgerInfo.muscles_secondary.length > 0
    ? wgerInfo.muscles_secondary.map((m) => MUSCLE_GROUP_MAP[m.id] ?? m.name).filter(Boolean)
    : null

  return {
    name_en: englishName,
    equipment,
    source: `wger:${wgerInfo.id}`,
    secondary_muscles: secondaryMuscles,
  }
}
