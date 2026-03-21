import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const SPLIT_LABELS: Record<string, string> = {
  auto: "letAIDecide",
  ppl: "PPL",
  upper_lower: "Upper / Lower",
  full_body: "Full Body",
  bro_split: "Bro Split",
}

export function AIConstraintStep({ onSubmit }: AIConstraintStepProps) {
  const { t } = useTranslation("create-program")
  const { data: profile } = useUserProfile()

  const form = useForm<ProgramConstraintsForm>({
    resolver: zodResolver(programConstraintsSchema),
    defaultValues: {
      daysPerWeek: profile?.training_days_per_week ?? 4,
      duration: profile?.session_duration_minutes ?? 60,
      goal: (profile?.goal as ProgramConstraintsForm["goal"]) ?? "hypertrophy",
      experience: (profile?.experience as ProgramConstraintsForm["experience"]) ?? "intermediate",
      equipmentCategory: profile?.equipment
        ? (mapEquipmentToCategory(profile.equipment) as ProgramConstraintsForm["equipmentCategory"])
        : "full-gym",
      focusAreas: "",
      splitPreference: "auto",
    },
  })

  function handleSubmit(data: ProgramConstraintsForm) {
    onSubmit({
      ...data,
      focusAreas: data.focusAreas || undefined,
      splitPreference: data.splitPreference === "auto" ? undefined : data.splitPreference,
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-8 pt-4"
    >
      <h2 className="text-lg font-semibold">{t("constraintTitle")}</h2>

      <fieldset className="flex flex-col gap-1.5">
        <Label>{t("daysPerWeek")}</Label>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => form.setValue("daysPerWeek", n)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                form.watch("daysPerWeek") === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <Label>{t("duration")}</Label>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => form.setValue("duration", d)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                form.watch("duration") === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {d}min
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <Label>{t("goal")}</Label>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => form.setValue("goal", g)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                form.watch("goal") === g
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {g.replace("_", " ")}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <Label>{t("experience")}</Label>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => form.setValue("experience", e)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                form.watch("experience") === e
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <Label>{t("equipment")}</Label>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button
              key={eq}
              type="button"
              onClick={() => form.setValue("equipmentCategory", eq)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                form.watch("equipmentCategory") === eq
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {eq.replace("-", " ")}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <Label>{t("splitPreference")}</Label>
        <div className="flex flex-wrap gap-2">
          {SPLIT_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => form.setValue("splitPreference", s)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                form.watch("splitPreference") === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              {s === "auto" ? t("letAIDecide") : SPLIT_LABELS[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <Label>{t("focusAreas")}</Label>
        <Input
          {...form.register("focusAreas")}
          placeholder={t("focusAreasPlaceholder")}
        />
      </fieldset>

      <Button type="submit" className="mt-2">
        {t("generate")}
      </Button>
    </form>
  )
}
