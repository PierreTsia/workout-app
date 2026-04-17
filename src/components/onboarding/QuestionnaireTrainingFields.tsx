import type { LucideIcon } from "lucide-react"
import {
  Mars,
  Venus,
  Ghost,
  EyeOff,
  BicepsFlexed,
  Target,
  HeartPulse,
  Zap,
  Sprout,
  Leaf,
  Flame,
  Dumbbell,
  Weight,
  Home,
  CalendarDays,
  Timer,
  Cake,
  Scale,
} from "lucide-react"
import { useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { weightUnitAtom } from "@/store/atoms"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useFormField,
} from "@/components/ui/form"
import {
  goalOptions,
  experienceOptions,
  equipmentOptions,
  genderOptions,
  durationOptions,
  type QuestionnaireValues,
} from "./schema"

const validationKeys: Record<string, string> = {
  Required: "validation_required",
  "Must be positive": "validation_positive",
  "Must be a number": "validation_number",
}

function TranslatedFormMessage() {
  const { t } = useTranslation("onboarding")
  const { error } = useFormField()
  const raw = error?.message
  if (!raw) return null
  const i18nKey = validationKeys[raw]
  return <FormMessage>{i18nKey ? t(i18nKey) : raw}</FormMessage>
}

interface OptionMeta {
  key: string
  icon: LucideIcon
}

const genderMeta: Record<string, OptionMeta> = {
  male: { key: "genderMale", icon: Mars },
  female: { key: "genderFemale", icon: Venus },
  other: { key: "genderOther", icon: Ghost },
  prefer_not_to_say: { key: "genderPreferNotToSay", icon: EyeOff },
}
const goalMeta: Record<string, OptionMeta> = {
  strength: { key: "goalStrength", icon: BicepsFlexed },
  hypertrophy: { key: "goalHypertrophy", icon: Target },
  endurance: { key: "goalEndurance", icon: HeartPulse },
  general_fitness: { key: "goalGeneralFitness", icon: Zap },
}
const expMeta: Record<string, OptionMeta> = {
  beginner: { key: "experienceBeginner", icon: Sprout },
  intermediate: { key: "experienceIntermediate", icon: Leaf },
  advanced: { key: "experienceAdvanced", icon: Flame },
}
const equipMeta: Record<string, OptionMeta> = {
  gym: { key: "equipmentGym", icon: Dumbbell },
  minimal: { key: "equipmentMinimal", icon: Home },
  home: { key: "equipmentHome", icon: Weight },
}

const toggleItemClass =
  "rounded-lg border border-border px-4 py-2.5 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"

/** Shared training questionnaire fields (onboarding + account settings). */
export function QuestionnaireTrainingFields() {
  const { control } = useFormContext<QuestionnaireValues>()
  const { t } = useTranslation("onboarding")
  const weightUnit = useAtomValue(weightUnitAtom)

  return (
    <div className="flex flex-col gap-8">
      <FormField
        control={control}
        name="gender"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("genderLabel")}</FormLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              className="flex-wrap justify-start gap-2"
              value={field.value ?? ""}
              onValueChange={(v) => {
                if (v) field.onChange(v)
              }}
            >
              {genderOptions.map((g) => {
                const Icon = genderMeta[g].icon
                return (
                  <ToggleGroupItem key={g} value={g} className={toggleItemClass}>
                    <Icon className="h-4 w-4" />
                    {t(genderMeta[g].key)}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="age"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="inline-flex items-center gap-1.5">
                <Cake className="h-4 w-4" />
                {t("ageLabel")}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={t("agePlaceholder")}
                  {...field}
                />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="weight"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="inline-flex items-center gap-1.5">
                <Scale className="h-4 w-4" />
                {t("weightLabel", { unit: weightUnit })}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder={t("weightPlaceholder")}
                  {...field}
                />
              </FormControl>
              <TranslatedFormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="goal"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("goalLabel")}</FormLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              className="flex-wrap justify-start gap-2"
              value={field.value ?? ""}
              onValueChange={(v) => {
                if (v) field.onChange(v)
              }}
            >
              {goalOptions.map((g) => {
                const Icon = goalMeta[g].icon
                return (
                  <ToggleGroupItem key={g} value={g} className={toggleItemClass}>
                    <Icon className="h-4 w-4" />
                    {t(goalMeta[g].key)}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="experience"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("experienceLabel")}</FormLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              className="flex-wrap justify-start gap-2"
              value={field.value ?? ""}
              onValueChange={(v) => {
                if (v) field.onChange(v)
              }}
            >
              {experienceOptions.map((e) => {
                const Icon = expMeta[e].icon
                return (
                  <ToggleGroupItem key={e} value={e} className={toggleItemClass}>
                    <Icon className="h-4 w-4" />
                    {t(expMeta[e].key)}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="equipment"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("equipmentLabel")}</FormLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              className="flex-wrap justify-start gap-2"
              value={field.value ?? ""}
              onValueChange={(v) => {
                if (v) field.onChange(v)
              }}
            >
              {equipmentOptions.map((eq) => {
                const Icon = equipMeta[eq].icon
                return (
                  <ToggleGroupItem key={eq} value={eq} className={toggleItemClass}>
                    <Icon className="h-4 w-4" />
                    {t(equipMeta[eq].key)}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <TranslatedFormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="training_days_per_week"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {t("daysLabel")}
            </FormLabel>
            <div className="flex items-center gap-4">
              <FormControl>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  className="h-2 flex-1 cursor-pointer accent-primary"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <span className="min-w-16 text-center text-sm font-medium">
                {t("daysValue", { count: Number(field.value) })}
              </span>
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="session_duration_minutes"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="inline-flex items-center gap-1.5">
              <Timer className="h-4 w-4" />
              {t("durationLabel")}
            </FormLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              className="flex-wrap justify-start gap-2"
              value={field.value ?? ""}
              onValueChange={(v) => {
                if (v) field.onChange(v)
              }}
            >
              {durationOptions.map((d) => (
                <ToggleGroupItem key={d} value={d} className={toggleItemClass}>
                  {d} min
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FormItem>
        )}
      />
    </div>
  )
}
