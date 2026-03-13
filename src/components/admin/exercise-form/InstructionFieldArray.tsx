import { useFieldArray, useFormContext } from "react-hook-form"
import { Plus, Trash2, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { ExerciseFormValues } from "./schema"

interface InstructionFieldArrayProps {
  name: "setup" | "movement" | "breathing" | "common_mistakes"
  label: string
  icon: LucideIcon
}

export function InstructionFieldArray({
  name,
  label,
  icon: Icon,
}: InstructionFieldArrayProps) {
  const { t } = useTranslation("admin")
  const { register } = useFormContext<ExerciseFormValues>()
  const { fields, append, remove } = useFieldArray<ExerciseFormValues>({
    name: `instructions.${name}`,
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              {...register(`instructions.${name}.${index}.value`)}
              placeholder={t("form.stepPlaceholder", { number: index + 1 })}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => append({ value: "" })}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        {t("form.addStep")}
      </Button>
    </div>
  )
}
