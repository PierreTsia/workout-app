import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useExerciseFilterOptions } from "@/hooks/useExerciseFilterOptions"
import {
  AI_FOCUS_AREAS_MAX_LENGTH,
  isFocusAreasTooLong,
} from "@/lib/aiFocusAreas"
import { toggleEquipmentCategory } from "@/lib/equipmentSelection"
import type {
  Duration,
  EquipmentCategory,
  GeneratorConstraints,
} from "@/types/generator"

const DURATIONS: Duration[] = [15, 30, 45, 60, 90]

const EQUIPMENT_CATEGORIES: { key: EquipmentCategory; label: string }[] = [
  { key: "bodyweight", label: "Bodyweight" },
  { key: "dumbbells", label: "Dumbbells" },
  { key: "full-gym", label: "Full Gym" },
]

interface ConstraintStepProps {
  constraints: GeneratorConstraints
  onChange: (constraints: GeneratorConstraints) => void
  onGenerate: () => void
  onAIGenerate: () => void
  isLoading: boolean
  isAILoading: boolean
}

export function ConstraintStep({
  constraints,
  onChange,
  onGenerate,
  onAIGenerate,
  isLoading,
  isAILoading,
}: ConstraintStepProps) {
  const { t } = useTranslation("generator")
  const { data: filterOptions } = useExerciseFilterOptions()
  const muscleGroups = filterOptions?.muscle_groups ?? []

  const isFullBody = constraints.muscleGroups.includes("full-body")
  const hasFullGym = constraints.equipmentCategories.includes("full-gym")
  const focusAreasTooLong = isFocusAreasTooLong(constraints.focusAreas)

  function toggleMuscleGroup(group: string) {
    if (group === "full-body") {
      onChange({ ...constraints, muscleGroups: ["full-body"] })
      return
    }

    const withoutFullBody = constraints.muscleGroups.filter(
      (g) => g !== "full-body",
    )
    const alreadySelected = withoutFullBody.includes(group)
    const next = alreadySelected
      ? withoutFullBody.filter((g) => g !== group)
      : [...withoutFullBody, group]

    onChange({
      ...constraints,
      muscleGroups: next.length === 0 ? ["full-body"] : next,
    })
  }

  function handleEquipmentClick(key: EquipmentCategory) {
    onChange({
      ...constraints,
      equipmentCategories: toggleEquipmentCategory(
        key,
        constraints.equipmentCategories,
      ),
    })
  }

  const pillClass = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
      active
        ? "border-transparent bg-primary text-primary-foreground"
        : "border-border bg-background text-muted-foreground hover:bg-accent",
    )

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("duration")}
        </span>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={constraints.duration === d}
              onClick={() => onChange({ ...constraints, duration: d })}
              className={pillClass(constraints.duration === d)}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("equipment")}
        </span>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {EQUIPMENT_CATEGORIES.map((eq) => {
            const active =
              eq.key === "full-gym"
                ? hasFullGym
                : !hasFullGym && constraints.equipmentCategories.includes(eq.key)
            return (
              <button
                key={eq.key}
                type="button"
                aria-pressed={active}
                onClick={() => handleEquipmentClick(eq.key)}
                className={pillClass(active)}
              >
                {t(`equipmentCategory.${eq.key}`, eq.label)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("focus")}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={isFullBody}
            onClick={() => toggleMuscleGroup("full-body")}
            className={pillClass(isFullBody)}
          >
            {t("fullBody")}
          </button>
          {muscleGroups.map((mg) => (
            <button
              key={mg}
              type="button"
              aria-pressed={
                !isFullBody && constraints.muscleGroups.includes(mg)
              }
              onClick={() => toggleMuscleGroup(mg)}
              className={pillClass(
                !isFullBody && constraints.muscleGroups.includes(mg),
              )}
            >
              {mg}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("focusAreasLabel")}
        </span>
        <Textarea
          value={constraints.focusAreas ?? ""}
          onChange={(e) =>
            onChange({ ...constraints, focusAreas: e.target.value })
          }
          placeholder={t("focusAreasPlaceholder")}
          maxLength={AI_FOCUS_AREAS_MAX_LENGTH}
          rows={3}
          className="resize-none text-sm"
          aria-label={t("focusAreasLabel")}
        />
        <span className="text-xs text-muted-foreground">
          {t("focusAreasHint")}
        </span>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          size="lg"
          onClick={onGenerate}
          disabled={isLoading || isAILoading}
        >
          {isLoading ? t("generating") : t("generate")}
        </Button>
        <Button
          className="flex-1"
          size="lg"
          onClick={onAIGenerate}
          disabled={
            isAILoading || isLoading || !navigator.onLine || focusAreasTooLong
          }
          title={
            focusAreasTooLong ? t("focusAreasTooLong") : undefined
          }
        >
          {isAILoading ? t("aiGenerating") : t("aiGenerate")}
        </Button>
      </div>
    </div>
  )
}
