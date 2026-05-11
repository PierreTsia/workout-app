import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import {
  questionnaireSchema,
  toQuestionnaireOutput,
  type QuestionnaireValues,
  type QuestionnaireOutput,
} from "./schema"
import { QuestionnaireTrainingFields } from "./QuestionnaireTrainingFields"

export interface QuestionnaireStepError {
  title: string
  body: string
}

export interface QuestionnaireStepProps {
  onNext: (data: QuestionnaireOutput) => void | Promise<void>
  // When set, renders an inline destructive alert above the submit button.
  // The parent (`OnboardingPage`) owns this state and feeds it from a
  // try/catch around `createProfile.mutateAsync` (#348). This component
  // stays dumb on purpose — Sentry capture / toast / sign-out redirect
  // all live in the parent so each error class can branch its UX.
  error?: QuestionnaireStepError | null
}

export function QuestionnaireStep({ onNext, error }: QuestionnaireStepProps) {
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

  // #348 — onSubmit is async + awaits onNext + swallows the rejection.
  // Previously this was sync and dropped the promise from `onNext`,
  // which let a raw Supabase PostgrestError escape to
  // `window.onunhandledrejection` and showed up in Sentry as opaque
  // `UnhandledRejection`s. RHF v7's `handleSubmit` does NOT swallow
  // async errors — it re-rejects, which React then fails to await on
  // the form's `onSubmit` prop, producing the same unhandled-rejection
  // class. The try/catch here is the belt: the parent's mutation hook
  // already owns the error (it's exposed via the `error` prop and via
  // `mutation.error` for Sentry/toast in the parent's catch).
  async function onSubmit(data: QuestionnaireValues) {
    try {
      await onNext(toQuestionnaireOutput(data))
    } catch {
      // Intentionally swallowed — parent handles UX + telemetry.
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pb-8 pt-4"
      >
        <h1 className="text-2xl font-bold">{t("questionnaireTitle")}</h1>

        <QuestionnaireTrainingFields />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{error.title}</AlertTitle>
            <AlertDescription>{error.body}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          size="lg"
          className="mt-auto w-full"
          disabled={form.formState.isSubmitting}
        >
          {t("next")}
        </Button>
      </form>
    </Form>
  )
}
