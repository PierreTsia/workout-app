import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { weightUnitAtom } from "@/store/atoms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  questionnaireSchema,
  goalOptions,
  experienceOptions,
  equipmentOptions,
  genderOptions,
  durationOptions,
  type QuestionnaireValues,
  type QuestionnaireOutput,
} from "./schema"
import { cn } from "@/lib/utils"

interface QuestionnaireStepProps {
  onNext: (data: QuestionnaireOutput) => void
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:border-primary/50",
      )}
    >
      {children}
    </button>
  )
}

export function QuestionnaireStep({ onNext }: QuestionnaireStepProps) {
  const { t } = useTranslation("onboarding")
  const weightUnit = useAtomValue(weightUnitAtom)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isValid, errors },
  } = useForm<QuestionnaireValues, unknown, QuestionnaireOutput>({
    resolver: zodResolver(questionnaireSchema),
    mode: "onChange",
    defaultValues: {
      gender: undefined,
      goal: undefined,
      experience: undefined,
      equipment: undefined,
      training_days_per_week: 3,
      session_duration_minutes: "60",
      age: "",
      weight: "",
    },
  })

  const selectedGender = watch("gender")
  const selectedGoal = watch("goal")
  const selectedExperience = watch("experience")
  const selectedEquipment = watch("equipment")
  const selectedDays = watch("training_days_per_week")
  const selectedDuration = watch("session_duration_minutes")

  const goalKeys: Record<string, string> = {
    strength: "goalStrength",
    hypertrophy: "goalHypertrophy",
    endurance: "goalEndurance",
    general_fitness: "goalGeneralFitness",
  }
  const expKeys: Record<string, string> = {
    beginner: "experienceBeginner",
    intermediate: "experienceIntermediate",
    advanced: "experienceAdvanced",
  }
  const equipKeys: Record<string, string> = {
    gym: "equipmentGym",
    minimal: "equipmentMinimal",
    home: "equipmentHome",
  }
  const genderKeys: Record<string, string> = {
    male: "genderMale",
    female: "genderFemale",
    other: "genderOther",
    prefer_not_to_say: "genderPreferNotToSay",
  }

  function onSubmit(data: QuestionnaireOutput) {
    onNext(data)
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pb-8 pt-4"
    >
      <h1 className="text-2xl font-bold">{t("questionnaireTitle")}</h1>

      <fieldset className="space-y-2">
        <Label>{t("genderLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {genderOptions.map((g) => (
            <OptionButton
              key={g}
              selected={selectedGender === g}
              onClick={() => setValue("gender", g, { shouldValidate: true })}
            >
              {t(genderKeys[g])}
            </OptionButton>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <Label className={errors.goal ? "text-destructive" : ""}>{t("goalLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((g) => (
            <OptionButton
              key={g}
              selected={selectedGoal === g}
              onClick={() => setValue("goal", g, { shouldValidate: true })}
            >
              {t(goalKeys[g])}
            </OptionButton>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <Label className={errors.experience ? "text-destructive" : ""}>{t("experienceLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {experienceOptions.map((e) => (
            <OptionButton
              key={e}
              selected={selectedExperience === e}
              onClick={() => setValue("experience", e, { shouldValidate: true })}
            >
              {t(expKeys[e])}
            </OptionButton>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <Label className={errors.equipment ? "text-destructive" : ""}>{t("equipmentLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {equipmentOptions.map((eq) => (
            <OptionButton
              key={eq}
              selected={selectedEquipment === eq}
              onClick={() => setValue("equipment", eq, { shouldValidate: true })}
            >
              {t(equipKeys[eq])}
            </OptionButton>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <Label>{t("daysLabel")}</Label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={2}
            max={6}
            step={1}
            className="h-2 flex-1 cursor-pointer accent-primary"
            {...register("training_days_per_week", { valueAsNumber: true })}
          />
          <span className="min-w-[4rem] text-center text-sm font-medium">
            {t("daysValue", { count: selectedDays })}
          </span>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <Label>{t("durationLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {durationOptions.map((d) => (
            <OptionButton
              key={d}
              selected={selectedDuration === String(d)}
              onClick={() =>
                setValue("session_duration_minutes", String(d) as "30" | "45" | "60" | "90", {
                  shouldValidate: true,
                })
              }
            >
              {t("durationMinutes", { count: d })}
            </OptionButton>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <fieldset className="space-y-2">
          <Label htmlFor="age">{t("ageLabel")}</Label>
          <Input
            id="age"
            type="number"
            inputMode="numeric"
            placeholder={t("agePlaceholder")}
            {...register("age")}
          />
        </fieldset>
        <fieldset className="space-y-2">
          <Label htmlFor="weight">{t("weightLabel", { unit: weightUnit })}</Label>
          <Input
            id="weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={t("weightPlaceholder")}
            {...register("weight")}
          />
        </fieldset>
      </div>

      <Button type="submit" size="lg" disabled={!isValid} className="mt-auto w-full">
        {t("next")}
      </Button>
    </form>
  )
}
