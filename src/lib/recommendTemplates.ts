import type { ProgramTemplate } from "@/types/onboarding"
import type { UserProfile } from "@/types/onboarding"

export function rankTemplates(
  templates: ProgramTemplate[],
  profile: UserProfile,
): ProgramTemplate[] {
  const days = profile.training_days_per_week

  const eligible = templates.filter(
    (t) => days >= t.min_days && days <= t.max_days,
  )

  return eligible
    .map((t) => {
      let score = 0
      if (t.primary_goal === profile.goal) score += 10
      if (t.experience_tags.includes(profile.experience)) score += 5
      return { template: t, score }
    })
    .sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name))
    .map((entry) => entry.template)
}
