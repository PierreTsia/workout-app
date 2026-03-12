/**
 * Mapping of French exercise names to Wger API base_ids.
 * Built from Wger exercise search API: https://wger.de/api/v2/exercise/search/
 *
 * Usage: suggestions[].data.base_id (NOT .id)
 */
export const WGER_EXERCISE_BASE_IDS: Record<string, number> = {
  // 1. Arnold Press Haltères
  "Arnold Press Haltères": 20, // Arnold Shoulder Press

  // 2. Papillon bras tendus (pec deck / chest fly machine)
  "Papillon bras tendus": 1904, // Pec Deck

  // 3. Élévations latérales
  "Élévations latérales": 348, // Lateral Raises

  // 4. Skull Crusher incliné
  "Skull Crusher incliné": 911, // Incline Skull Crush

  // 5. Presse à cuisse
  "Presse à cuisse": 371, // Leg Press

  // 6. Élévation mollet machine (standing calf raise machine)
  "Élévation mollet machine": 622, // Standing Calf Raises

  // 7. Crunch assis machine
  "Crunch assis machine": 172, // Crunches on Machine

  // 8. Rangées prise serrée neutre (close grip cable row)
  "Rangées prise serrée neutre": 512, // Rowing seated, narrow grip

  // 9. Rangées prise large pronation (wide grip cable row)
  "Rangées prise large pronation": 1117, // Seated Cable Row

  // 10. Curls biceps inclinés
  "Curls biceps inclinés": 204, // Dumbbell Incline Curl

  // 11. Papillon inverse (reverse pec deck)
  "Papillon inverse": 1775, // Pec deck rear delt fly

  // 12. Shrugs haltères
  "Shrugs haltères": 1645, // Dumbbell Shrug

  // 13. Soulevé de terre roumain
  "Soulevé de terre roumain": 1750, // Romanian Deadlift

  // 14. Extension du dos machine (back extension / hyperextension)
  "Extension du dos machine": 301, // Hyperextensions

  // 15. Crunch à genoux poulie
  "Crunch à genoux poulie": 173, // Crunches With Cable

  // 16. Développé couché (flat barbell bench press)
  "Développé couché": 73, // Bench Press

  // 17. Tirage latéral prise large
  "Tirage latéral prise large": 1697, // Lat Pulldown (Wide Grip)

  // 18. Pec Deck bras tendus (same machine as Papillon, arms straight)
  "Pec Deck bras tendus": 1904, // Pec Deck

  // 19. Extension triceps corde
  "Extension triceps corde": 1900, // Tricep Rope Pushdowns

  // 20. Curls stricts barre
  "Curls stricts barre": 91, // Biceps Curls With Barbell

  // 21. Extension de jambe machine
  "Extension de jambe machine": 369, // Leg Extension

  // 22. Leg Curl assis
  "Leg Curl assis": 366, // Leg Curls (sitting)

  // 23. Extension mollet machine (seated calf raise)
  "Extension mollet machine": 1365, // Calf Raise with machine (seated)
} as const;

export type WgerExerciseNameFr = keyof typeof WGER_EXERCISE_BASE_IDS;
