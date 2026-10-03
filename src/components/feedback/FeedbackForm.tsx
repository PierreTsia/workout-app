import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { useAtomValue } from "jotai"
import { Field, Input, Textarea } from "@nomosui/react"
import { authAtom } from "@/store/atoms"
import { Button } from "@/components/ui/button"
import { MultiSelect } from "@/components/ui/multi-select"
import { Separator } from "@/components/ui/separator"
import {
  feedbackFormSchema,
  formValuesToPayload,
  type FeedbackFormValues,
  type FeedbackSourceScreen,
} from "./schema"
import { useSubmitFeedback } from "@/hooks/useSubmitFeedback"
import { cn } from "@/lib/utils"

const ILLUSTRATION_OPTIONS = [
  "wrong_exercise",
  "misleading_angle",
  "other",
] as const
const VIDEO_OPTIONS = ["different_exercise", "poor_quality", "other"] as const
const DESCRIPTION_OPTIONS = [
  "unrelated",
  "wrong_muscle",
  "missing_steps",
  "other",
] as const

function illustrationLabel(opt: (typeof ILLUSTRATION_OPTIONS)[number]) {
  return opt === "wrong_exercise" ? "wrongExercise" : opt === "misleading_angle" ? "misleadingAngle" : "other"
}
function videoLabel(opt: (typeof VIDEO_OPTIONS)[number]) {
  return opt === "different_exercise" ? "differentExercise" : opt === "poor_quality" ? "poorQuality" : "other"
}
function descriptionLabel(opt: (typeof DESCRIPTION_OPTIONS)[number]) {
  return opt === "unrelated" ? "unrelated" : opt === "wrong_muscle" ? "wrongMuscle" : opt === "missing_steps" ? "missingSteps" : "other"
}

function isIllustration(value: string): value is (typeof ILLUSTRATION_OPTIONS)[number] {
  return ILLUSTRATION_OPTIONS.some((opt) => opt === value)
}
function isVideo(value: string): value is (typeof VIDEO_OPTIONS)[number] {
  return VIDEO_OPTIONS.some((opt) => opt === value)
}
function isDescription(value: string): value is (typeof DESCRIPTION_OPTIONS)[number] {
  return DESCRIPTION_OPTIONS.some((opt) => opt === value)
}

interface FeedbackFormProps {
  exerciseId: string
  sourceScreen: FeedbackSourceScreen
  onSuccess: () => void
}

export function FeedbackForm({
  exerciseId,
  sourceScreen,
  onSuccess,
}: FeedbackFormProps) {
  const { t } = useTranslation("feedback")
  const user = useAtomValue(authAtom)
  const submitFeedback = useSubmitFeedback()

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    mode: "onChange",
    defaultValues: {
      whatIllustration: false,
      whatVideo: false,
      whatDescription: false,
      illustration: [],
      video: [],
      description: [],
      other_illustration_text: "",
      other_video_text: "",
      other_description_text: "",
      comment: "",
    },
  })

  const trans = (message: string | undefined) => (message ? t(message) : undefined)
  const errors = form.formState.errors

  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch() is inherently non-memoizable
  const watchWhat = form.watch([
    "whatIllustration",
    "whatVideo",
    "whatDescription",
  ])
  const watchIllustration = form.watch("illustration")
  const watchVideo = form.watch("video")
  const watchDescription = form.watch("description")
  const [whatIllustration, whatVideo, whatDescription] = watchWhat
  const whatValue = [
    whatIllustration ? "illustration" : null,
    whatVideo ? "video" : null,
    whatDescription ? "description" : null,
  ].filter((value): value is string => value !== null)
  const hasOtherIllustration = watchIllustration.includes("other")
  const hasOtherVideo = watchVideo.includes("other")
  const hasOtherDescription = watchDescription.includes("other")

  async function handleSubmit(values: FeedbackFormValues) {
    if (!user?.email || !user?.id) return
    const payload = formValuesToPayload(
      values,
      exerciseId,
      user.email,
      user.id,
      sourceScreen,
    )
    try {
      await submitFeedback.submit(payload)
      onSuccess()
    } catch {
      // Error toast handled in hook
    }
  }

  if (!user?.email) return null

  const whatOptions = [
    { value: "illustration", label: t("whatIllustration") },
    { value: "video", label: t("whatVideo") },
    { value: "description", label: t("whatDescription") },
  ]
  const illustrationOptions = ILLUSTRATION_OPTIONS.map((opt) => ({
    value: opt,
    label: t(`illustration.${illustrationLabel(opt)}`),
  }))
  const videoOptions = VIDEO_OPTIONS.map((opt) => ({
    value: opt,
    label: t(`video.${videoLabel(opt)}`),
  }))
  const descriptionOptions = DESCRIPTION_OPTIONS.map((opt) => ({
    value: opt,
    label: t(`description.${descriptionLabel(opt)}`),
  }))

  const isSubmitDisabled = submitFeedback.isPending

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex min-h-0 flex-1 flex-col"
    >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          <div className="flex flex-col gap-5 pt-2">

            {/* User */}
            <p className="text-xs text-muted-foreground">
              {t("reportingAs", { email: user.email })}
            </p>

            <Separator />

            {/* Step 1 */}
            <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  1
                </span>
                <p className="text-sm font-semibold text-foreground">
                  {t("step1Title")}
                </p>
              </div>

              <Field error={trans(errors.whatIllustration?.message)}>
                <div className="flex flex-wrap gap-2">
                  {whatOptions.map((opt) => {
                    const active = whatValue.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const field = opt.value === "illustration"
                            ? "whatIllustration" as const
                            : opt.value === "video"
                              ? "whatVideo" as const
                              : "whatDescription" as const
                          const nextActive = !active
                          form.setValue(field, nextActive, { shouldValidate: true })
                          if (!nextActive) {
                            const arrayField = opt.value as "illustration" | "video" | "description"
                            const otherField = opt.value === "illustration"
                              ? "other_illustration_text" as const
                              : opt.value === "video"
                                ? "other_video_text" as const
                                : "other_description_text" as const
                            form.setValue(arrayField, [], { shouldValidate: true })
                            form.setValue(otherField, "", { shouldValidate: true })
                          }
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            {/* Step 2 */}
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out",
                (whatIllustration || whatVideo || whatDescription)
                  ? "grid-rows-[1fr]"
                  : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
              <div
                className={cn(
                  "rounded-lg border border-border p-4 flex flex-col gap-4 transition-opacity duration-300",
                  (whatIllustration || whatVideo || whatDescription)
                    ? "opacity-100"
                    : "opacity-0",
                )}>

                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    2
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {t("step2Title")}
                  </p>
                </div>

                {whatIllustration && (
                  <div className="rounded-md bg-muted/30 p-3 flex flex-col gap-3">
                    <Field
                      htmlFor="illustration"
                      label={
                        <span className="text-xs font-semibold text-foreground/80">
                          {t("whatIllustration")}
                        </span>
                      }
                      error={trans(errors.illustration?.message)}
                    >
                      <MultiSelect
                        id="illustration"
                        options={illustrationOptions}
                        value={watchIllustration}
                        onChange={(next) =>
                          form.setValue("illustration", next.filter(isIllustration), {
                            shouldValidate: true,
                          })
                        }
                        placeholder={t("selectIssues")}
                      />
                    </Field>
                    {hasOtherIllustration && (
                      <Field
                        htmlFor="other_illustration_text"
                        label={<span className="text-xs">{t("otherIllustrationLabel")} *</span>}
                        error={trans(errors.other_illustration_text?.message)}
                      >
                        <Input
                          id="other_illustration_text"
                          placeholder={t("otherPlaceholder")}
                          className="h-9"
                          {...form.register("other_illustration_text")}
                        />
                      </Field>
                    )}
                  </div>
                )}

                {whatVideo && (
                  <div className="rounded-md bg-muted/30 p-3 flex flex-col gap-3">
                    <Field
                      htmlFor="video"
                      label={
                        <span className="text-xs font-semibold text-foreground/80">
                          {t("whatVideo")}
                        </span>
                      }
                      error={trans(errors.video?.message)}
                    >
                      <MultiSelect
                        id="video"
                        options={videoOptions}
                        value={watchVideo}
                        onChange={(next) =>
                          form.setValue("video", next.filter(isVideo), {
                            shouldValidate: true,
                          })
                        }
                        placeholder={t("selectIssues")}
                      />
                    </Field>
                    {hasOtherVideo && (
                      <Field
                        htmlFor="other_video_text"
                        label={<span className="text-xs">{t("otherVideoLabel")} *</span>}
                        error={trans(errors.other_video_text?.message)}
                      >
                        <Input
                          id="other_video_text"
                          placeholder={t("otherPlaceholder")}
                          className="h-9"
                          {...form.register("other_video_text")}
                        />
                      </Field>
                    )}
                  </div>
                )}

                {whatDescription && (
                  <div className="rounded-md bg-muted/30 p-3 flex flex-col gap-3">
                    <Field
                      htmlFor="description"
                      label={
                        <span className="text-xs font-semibold text-foreground/80">
                          {t("whatDescription")}
                        </span>
                      }
                      error={trans(errors.description?.message)}
                    >
                      <MultiSelect
                        id="description"
                        options={descriptionOptions}
                        value={watchDescription}
                        onChange={(next) =>
                          form.setValue("description", next.filter(isDescription), {
                            shouldValidate: true,
                          })
                        }
                        placeholder={t("selectIssues")}
                      />
                    </Field>
                    {hasOtherDescription && (
                      <Field
                        htmlFor="other_description_text"
                        label={<span className="text-xs">{t("otherDescriptionLabel")} *</span>}
                        error={trans(errors.other_description_text?.message)}
                      >
                        <Input
                          id="other_description_text"
                          placeholder={t("otherPlaceholder")}
                          className="h-9"
                          {...form.register("other_description_text")}
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Comment */}
            <Field
              htmlFor="comment"
              label={t("commentPlaceholder")}
              error={trans(errors.comment?.message)}
            >
              <Textarea
                id="comment"
                placeholder={t("commentPlaceholder")}
                rows={3}
                {...form.register("comment")}
              />
            </Field>
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4">
          <Button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full"
          >
            {submitFeedback.isPending ? t("submitting") : t("submit")}
          </Button>
        </div>
    </form>
  )
}
