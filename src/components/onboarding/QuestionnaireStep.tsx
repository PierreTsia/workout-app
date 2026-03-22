import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import {
  questionnaireSchema,
  toQuestionnaireOutput,
  type QuestionnaireValues,
  type QuestionnaireOutput,
} from "./schema"
import { QuestionnaireTrainingFields } from "./QuestionnaireTrainingFields"

interface QuestionnaireStepProps {
  onNext: (data: QuestionnaireOutput) => void
}

export function QuestionnaireStep({ onNext }: QuestionnaireStepProps) {
  const { t } = useTranslation("onboarding")

  const form = useForm<QuestionnaireValues>({
    resolver: zodResolver(questionnaireSchema),
    mode: "onTouched",
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

  function onSubmit(data: QuestionnaireValues) {
    onNext(toQuestionnaireOutput(data))
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pb-8 pt-4"
      >
        <h1 className="text-2xl font-bold">{t("questionnaireTitle")}</h1>

        <QuestionnaireTrainingFields control={form.control} />

        <Button type="submit" size="lg" className="mt-auto w-full">
          {t("next")}
        </Button>
      </form>
    </Form>
  )
}
