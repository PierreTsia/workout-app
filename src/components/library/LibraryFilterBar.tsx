import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import type { UserGoal, UserExperience, UserEquipment } from "@/types/onboarding"

const GOALS: UserGoal[] = ["strength", "hypertrophy", "endurance", "general_fitness"]
const EXPERIENCES: UserExperience[] = ["beginner", "intermediate", "advanced"]
const EQUIPMENTS: UserEquipment[] = ["gym", "home", "minimal"]

interface LibraryFilterBarProps {
  selectedGoal: UserGoal | null
  selectedExperience: UserExperience | null
  selectedEquipment: UserEquipment | null
  onGoalChange: (v: UserGoal | null) => void
  onExperienceChange: (v: UserExperience | null) => void
  onEquipmentChange: (v: UserEquipment | null) => void
}

function PillRow<T extends string>({
  items,
  selected,
  onToggle,
  labelKey,
}: {
  items: readonly T[]
  selected: T | null
  onToggle: (v: T | null) => void
  labelKey: (v: T) => string
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={selected === item}
          onClick={() => onToggle(selected === item ? null : item)}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            selected === item
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:bg-accent",
          )}
        >
          {labelKey(item)}
        </button>
      ))}
    </div>
  )
}

export function LibraryFilterBar({
  selectedGoal,
  selectedExperience,
  selectedEquipment,
  onGoalChange,
  onExperienceChange,
  onEquipmentChange,
}: LibraryFilterBarProps) {
  const { t } = useTranslation("library")

  const hasAnyFilter = selectedGoal !== null || selectedExperience !== null || selectedEquipment !== null

  const goalLabels: Record<UserGoal, string> = {
    strength: t("filterGoalStrength"),
    hypertrophy: t("filterGoalHypertrophy"),
    endurance: t("filterGoalEndurance"),
    general_fitness: t("filterGoalGeneralFitness"),
  }

  const experienceLabels: Record<UserExperience, string> = {
    beginner: t("filterExperienceBeginner"),
    intermediate: t("filterExperienceIntermediate"),
    advanced: t("filterExperienceAdvanced"),
  }

  const equipmentLabels: Record<UserEquipment, string> = {
    gym: t("filterEquipmentGym"),
    home: t("filterEquipmentHome"),
    minimal: t("filterEquipmentMinimal"),
  }

  return (
    <div className="flex flex-col gap-2">
      <PillRow items={GOALS} selected={selectedGoal} onToggle={onGoalChange} labelKey={(v) => goalLabels[v]} />
      <PillRow items={EXPERIENCES} selected={selectedExperience} onToggle={onExperienceChange} labelKey={(v) => experienceLabels[v]} />
      <PillRow items={EQUIPMENTS} selected={selectedEquipment} onToggle={onEquipmentChange} labelKey={(v) => equipmentLabels[v]} />
      {hasAnyFilter && (
        <button
          type="button"
          onClick={() => {
            onGoalChange(null)
            onExperienceChange(null)
            onEquipmentChange(null)
          }}
          className="self-start text-xs text-primary underline-offset-2 hover:underline"
        >
          {t("clearFilters")}
        </button>
      )}
    </div>
  )
}
