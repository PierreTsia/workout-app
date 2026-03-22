import { mapEquipmentToCategory } from "@/components/create-program/schema"
import type { GenerateProgramConstraints } from "@/types/aiProgram"
import type { UserProfile } from "@/types/onboarding"

const ALLOWED_DURATIONS = [15, 30, 45, 60, 90] as const

function normalizeDuration(minutes: number): (typeof ALLOWED_DURATIONS)[number] {
  if (ALLOWED_DURATIONS.includes(minutes as (typeof ALLOWED_DURATIONS)[number])) {
    return minutes as (typeof ALLOWED_DURATIONS)[number]
  }
  let best: (typeof ALLOWED_DURATIONS)[number] = 60
  let bestDist = Infinity
  for (const a of ALLOWED_DURATIONS) {
    const d = Math.abs(a - minutes)
    if (d < bestDist) {
      bestDist = d
      best = a
    }
  }
  return best
}

/**
 * Builds AI program constraints from onboarding `user_profiles` data — same mapping as
 * `AIConstraintStep` after profile prefill, without optional focus/split overrides (AI decides).
 */
export function userProfileToGenerateProgramConstraints(
  profile: UserProfile,
  locale?: string,
): GenerateProgramConstraints {
  const daysPerWeek = Math.min(7, Math.max(2, profile.training_days_per_week))
  return {
    daysPerWeek,
    duration: normalizeDuration(profile.session_duration_minutes),
    equipmentCategory: mapEquipmentToCategory(profile.equipment),
    goal: profile.goal,
    experience: profile.experience,
    focusAreas: undefined,
    splitPreference: undefined,
    locale,
  }
}
