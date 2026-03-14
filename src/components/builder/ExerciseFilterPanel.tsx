import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"] as const

interface ExerciseFilterPanelProps {
  muscleGroups: string[]
  equipmentTypes: string[]
  difficultyLevels: string[]
  selectedMuscleGroup: string | null
  selectedEquipment: string[]
  selectedDifficulty: string[]
  onMuscleGroupChange: (group: string | null) => void
  onEquipmentChange: (equipment: string[]) => void
  onDifficultyChange: (v: string[]) => void
}

export function ExerciseFilterPanel({
  muscleGroups,
  equipmentTypes,
  difficultyLevels,
  selectedMuscleGroup,
  selectedEquipment,
  selectedDifficulty,
  onMuscleGroupChange,
  onEquipmentChange,
  onDifficultyChange,
}: ExerciseFilterPanelProps) {
  const { t } = useTranslation("builder")

  const sortedDifficultyLevels = useMemo(
    () =>
      [...(difficultyLevels ?? [])].sort(
        (a, b) =>
          DIFFICULTY_ORDER.indexOf(a as (typeof DIFFICULTY_ORDER)[number]) -
          DIFFICULTY_ORDER.indexOf(b as (typeof DIFFICULTY_ORDER)[number]),
      ),
    [difficultyLevels],
  )

  function toggleEquipment(value: string) {
    if (selectedEquipment.includes(value)) {
      onEquipmentChange(selectedEquipment.filter((e) => e !== value))
    } else {
      onEquipmentChange([...selectedEquipment, value])
    }
  }

  function toggleDifficulty(value: string) {
    if (selectedDifficulty.includes(value)) {
      onDifficultyChange(selectedDifficulty.filter((d) => d !== value))
    } else {
      onDifficultyChange([...selectedDifficulty, value])
    }
  }

  return (
    <div className="flex flex-col gap-2 px-3 pb-2">
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
        {muscleGroups.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() =>
              onMuscleGroupChange(selectedMuscleGroup === group ? null : group)
            }
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              selectedMuscleGroup === group
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {group}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
        {equipmentTypes.map((eq) => (
          <button
            key={eq}
            type="button"
            onClick={() => toggleEquipment(eq)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              selectedEquipment.includes(eq)
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {t(`equipment.${eq}`, eq)}
          </button>
        ))}
      </div>

      {sortedDifficultyLevels.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("difficulty_label")}
          </span>
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
            {sortedDifficultyLevels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleDifficulty(level)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  selectedDifficulty.includes(level)
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                {t(`difficulty.${level}`, level)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
