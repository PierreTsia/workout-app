/** Hypertrophy weekly-set band (primary 1 / secondary 0.5). */
export const HYPERTROPHY_VOLUME_MIN = 8
export const HYPERTROPHY_VOLUME_MAX = 20

/** Hypertrophy distinct-day band. */
export const HYPERTROPHY_FREQUENCY_MIN = 2
export const HYPERTROPHY_FREQUENCY_MAX = 3

/** Share of programmed muscles in *both* volume and frequency bands. */
export const HYPERTROPHY_ROLLUP_SHORT = 1 / 3
export const HYPERTROPHY_ROLLUP_OK = 2 / 3

/** Strength-shaped solo: parsed rep max and rest. */
export const STRENGTH_REP_MAX = 6
export const STRENGTH_REST_MIN_SECONDS = 150

/** Strength share of solo sets. */
export const STRENGTH_SHARE_SHORT = 0.2
export const STRENGTH_SHARE_OK = 0.4

/** Dense solo: high-rep or duration, short rest. */
export const ENDURANCE_DENSE_REPS_MIN = 12
export const ENDURANCE_DENSE_REST_MAX_SECONDS = 60

/** Dense-set share used when Circuit count is 0 or 1. */
export const ENDURANCE_DENSE_SHARE = 0.2

/** Circuit count bands. AMRAP and Tours weigh the same. */
export const ENDURANCE_CIRCUITS_OK = 1
export const ENDURANCE_CIRCUITS_HIGH = 2

export const EQUIPMENT_FREE = [
  "barbell",
  "dumbbell",
  "ez_bar",
  "kettlebell",
] as const

export const EQUIPMENT_MACHINE = ["machine", "cable"] as const

export const EQUIPMENT_BODYWEIGHT = ["bodyweight"] as const

export const EQUIPMENT_OTHER = ["band", "bench", "other"] as const
