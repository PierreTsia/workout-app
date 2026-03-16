/**
 * Hardcoded mapping of existing 23 exercises (French name → Wger base ID).
 * Built manually by searching https://wger.de/api/v2/exercise/search/.
 * Used by the import script to backfill equipment, name_en, source, secondary_muscles
 * on existing exercises WITHOUT overwriting name, instructions, youtube_url, image_url, emoji.
 */
export const EXISTING_EXERCISE_MAP: Record<string, number> = {
  "Arnold Press Haltères": 20,
  "Papillon bras tendus": 1904,
  "Élévations latérales": 348,
  "Skull Crusher incliné": 911,
  "Presse à cuisse": 371,
  "Élévation mollet machine": 622,
  "Crunch assis machine": 172,
  "Rangées prise serrée neutre": 512,
  "Rangées prise large pronation": 1117,
  "Curls biceps inclinés": 204,
  "Papillon inverse": 1775,
  "Shrugs haltères": 1645,
  "Soulevé de terre roumain": 1750,
  "Extension du dos machine": 301,
  "Crunch à genoux poulie": 173,
  "Développé couché": 73,
  "Tirage latéral prise large": 1697,
  "Pec Deck bras tendus": 1904,
  "Extension triceps corde": 1900,
  "Curls stricts barre": 91,
  "Extension de jambe machine": 369,
  "Leg Curl assis": 366,
  "Extension mollet machine": 1365,
}

/** Wger equipment ID → constrained app value */
export const EQUIPMENT_MAP: Record<number, string> = {
  1: "barbell",
  2: "ez_bar",
  3: "dumbbell",
  4: "bodyweight",
  5: "other",
  6: "bodyweight",
  7: "bodyweight",
  8: "bench",
  9: "bench",
  10: "kettlebell",
  11: "band",
}

/**
 * Wger primary muscle ID → app muscle_group (French).
 * When an exercise has multiple primary muscles, the first match wins.
 */
export const MUSCLE_GROUP_MAP: Record<number, string> = {
  4: "Pectoraux",
  2: "Épaules",
  5: "Triceps",
  1: "Biceps",
  13: "Biceps",
  12: "Dos",
  9: "Trapèzes",
  10: "Quadriceps",
  11: "Ischios",
  8: "Fessiers",
  7: "Mollets",
  15: "Mollets",
  6: "Abdos",
  14: "Abdos",
  3: "Abdos",
}

/** Wger category ID → fallback muscle_group when no muscle data */
export const CATEGORY_FALLBACK_MAP: Record<number, string> = {
  10: "Abdos",
  8: "Biceps",
  12: "Dos",
  14: "Mollets",
  11: "Pectoraux",
  9: "Quadriceps",
  13: "Épaules",
  15: "Cardio",
}

/** Muscle group → default emoji for new exercises */
export const MUSCLE_EMOJI_MAP: Record<string, string> = {
  "Pectoraux": "🏋️",
  "Épaules": "🙆",
  "Triceps": "💪",
  "Biceps": "💪",
  "Dos": "🚣",
  "Trapèzes": "🤷",
  "Quadriceps": "🦵",
  "Ischios": "🦵",
  "Fessiers": "🍑",
  "Adducteurs": "🦵",
  "Mollets": "🦶",
  "Abdos": "🔥",
  "Lombaires": "🔙",
  "Deltoïdes post.": "🦅",
  "Cardio": "❤️",
}
