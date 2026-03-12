import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface ExerciseFilterPanelProps {
  muscleGroups: string[]
  equipmentTypes: string[]
  selectedMuscleGroup: string | null
  selectedEquipment: string[]
  onMuscleGroupChange: (group: string | null) => void
  onEquipmentChange: (equipment: string[]) => void
}

export function ExerciseFilterPanel({
  muscleGroups,
  equipmentTypes,
  selectedMuscleGroup,
  selectedEquipment,
  onMuscleGroupChange,
  onEquipmentChange,
}: ExerciseFilterPanelProps) {
  const { t } = useTranslation("builder")

  function toggleEquipment(value: string) {
    if (selectedEquipment.includes(value)) {
      onEquipmentChange(selectedEquipment.filter((e) => e !== value))
    } else {
      onEquipmentChange([...selectedEquipment, value])
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
    </div>
  )
}
