import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { useUserProfile } from "@/hooks/useUserProfile"
import {
  programConstraintsSchema,
  mapEquipmentToCategory,
  type ProgramConstraintsForm,
} from "./schema"
import type { GenerateProgramConstraints } from "@/types/aiProgram"

interface AIConstraintStepProps {
  onSubmit: (constraints: GenerateProgramConstraints) => void
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const
const GOAL_OPTIONS = ["strength", "hypertrophy", "endurance", "general_fitness"] as const
const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "advanced"] as const
const EQUIPMENT_OPTIONS = ["bodyweight", "dumbbells", "full-gym"] as const
const SPLIT_OPTIONS = ["auto", "ppl", "upper_lower", "full_body", "bro_split"] as const

const DAYS_RANGE = [2, 3, 4, 5, 6, 7] as const

function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  renderLabel,
  size = "md",
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  renderLabel: (v: T) => string
  size?: "sm" | "md"
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-lg border text-sm font-medium transition-colors ${
            size === "sm" ? "flex h-10 w-10 items-center justify-center" : "px-3 py-2"
          } ${
            value === opt
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-accent"
          }`}
        >
          {renderLabel(opt)}
        </button>
      ))}
    </div>
  )
}

export function AIConstraintStep({ onSubmit }: AIConstraintStepProps) {
  const { t, i18n } = useTranslation("create-program")
  const { data: profile } = useUserProfile()

  const form = useForm<ProgramConstraintsForm>({
    resolver: zodResolver(programConstraintsSchema),
    defaultValues: {
      daysPerWeek: 4,
      duration: 60,
      goal: "hypertrophy",
      experience: "intermediate",
      equipmentCategory: "full-gym",
      focusAreas: "",
      splitPreference: "auto",
    },
  })

  const profileApplied = useRef(false)
  useEffect(() => {
    if (!profile || profileApplied.current) return
    profileApplied.current = true
    form.reset({
      ...form.getValues(),
      daysPerWeek: profile.training_days_per_week ?? 4,
      duration: profile.session_duration_minutes ?? 60,
      goal: (profile.goal as ProgramConstraintsForm["goal"]) ?? "hypertrophy",
      experience: (profile.experience as ProgramConstraintsForm["experience"]) ?? "intermediate",
      equipmentCategory: profile.equipment
        ? (mapEquipmentToCategory(profile.equipment) as ProgramConstraintsForm["equipmentCategory"])
        : "full-gym",
    })
  }, [profile, form])

  function handleSubmit(data: ProgramConstraintsForm) {
    onSubmit({
      ...data,
      focusAreas: data.focusAreas || undefined,
      splitPreference: data.splitPreference === "auto" ? undefined : data.splitPreference,
      locale: i18n.language,
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-8 pt-4"
      >
        <h2 className="text-lg font-semibold">{t("constraintTitle")}</h2>

        <FormField
          control={form.control}
          name="daysPerWeek"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("daysPerWeek")}</FormLabel>
              <FormControl>
                <ChipGroup
                  options={DAYS_RANGE}
                  value={field.value}
                  onChange={field.onChange}
                  renderLabel={String}
                  size="sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("duration")}</FormLabel>
              <FormControl>
                <ChipGroup
                  options={DURATION_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  renderLabel={(d) => `${d}min`}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="goal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("goal")}</FormLabel>
              <FormControl>
                <ChipGroup
                  options={GOAL_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  renderLabel={(g) => t(`goal_${g}`)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="experience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("experience")}</FormLabel>
              <FormControl>
                <ChipGroup
                  options={EXPERIENCE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  renderLabel={(e) => t(`experience_${e}`)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="equipmentCategory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("equipment")}</FormLabel>
              <FormControl>
                <ChipGroup
                  options={EQUIPMENT_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  renderLabel={(eq) => t(`equipment_${eq}`)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="splitPreference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("splitPreference")}</FormLabel>
              <FormControl>
                <ChipGroup
                  options={SPLIT_OPTIONS}
                  value={field.value ?? "auto"}
                  onChange={field.onChange}
                  renderLabel={(s) => s === "auto" ? t("letAIDecide") : t(`split_${s}`)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="focusAreas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("focusAreas")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t("focusAreasPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="mt-2">
          {t("generate")}
        </Button>
      </form>
    </Form>
  )
}
