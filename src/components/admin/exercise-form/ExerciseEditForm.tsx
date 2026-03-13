import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Activity, AlertTriangle, Settings2, Wind } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { Exercise } from "@/types/database"
import { exerciseFormSchema, type ExerciseFormValues } from "./schema"
import { toFormValues } from "./transforms"
import { InstructionFieldArray } from "./InstructionFieldArray"

interface ExerciseEditFormProps {
  exercise: Exercise
  onSubmit: (values: ExerciseFormValues) => void
  isPending: boolean
}

export function ExerciseEditForm({
  exercise,
  onSubmit,
  isPending,
}: ExerciseEditFormProps) {
  const { t } = useTranslation("admin")

  const methods = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: toFormValues(exercise),
  })

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.name")}>
            <Input {...methods.register("name")} />
          </Field>
          <Field label={t("form.nameEn")}>
            <Input {...methods.register("name_en")} />
          </Field>
          <Field label={t("form.muscleGroup")}>
            <Input {...methods.register("muscle_group")} />
          </Field>
          <Field label={t("form.equipment")}>
            <Input {...methods.register("equipment")} />
          </Field>
          <Field label={t("form.emoji")}>
            <Input {...methods.register("emoji")} className="w-20" />
          </Field>
          <Field label={t("form.secondaryMuscles")}>
            <Input
              {...methods.register("secondary_muscles")}
              placeholder="e.g. biceps, forearms"
            />
          </Field>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.youtubeUrl")}>
            <Input
              {...methods.register("youtube_url")}
              type="url"
              placeholder="https://youtube.com/watch?v=..."
            />
          </Field>
          <Field label={t("form.imageUrl")}>
            <Input
              {...methods.register("image_url")}
              type="url"
              placeholder="https://..."
            />
          </Field>
        </div>

        <Separator />

        <div className="flex flex-col gap-6">
          <h3 className="text-lg font-semibold">Instructions</h3>
          <InstructionFieldArray
            name="setup"
            label={t("form.setup")}
            icon={Settings2}
          />
          <InstructionFieldArray
            name="movement"
            label={t("form.movement")}
            icon={Activity}
          />
          <InstructionFieldArray
            name="breathing"
            label={t("form.breathing")}
            icon={Wind}
          />
          <InstructionFieldArray
            name="common_mistakes"
            label={t("form.commonMistakes")}
            icon={AlertTriangle}
          />
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}
