import { useTranslation } from "react-i18next"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import type { ExerciseContentFeedback } from "@/types/database"

interface FeedbackDetailRowProps {
  feedback: ExerciseContentFeedback
}

function parseErrorDetails(
  errorDetails: Record<string, string[]>,
  t: (key: string) => string,
): { field: string; options: string[] }[] {
  return Object.entries(errorDetails)
    .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
    .map(([field, options]) => ({
      field: t(`feedback.fields.${field}`),
      options: options.map((opt) => t(`feedback.errorOptions.${opt}`)),
    }))
}

export function FeedbackDetailRow({ feedback }: FeedbackDetailRowProps) {
  const { t, i18n } = useTranslation("admin")
  const details = parseErrorDetails(feedback.error_details ?? {}, t)

  const otherTexts = [
    { label: t("feedback.fields.illustration"), value: feedback.other_illustration_text },
    { label: t("feedback.fields.video"), value: feedback.other_video_text },
    { label: t("feedback.fields.description"), value: feedback.other_description_text },
  ].filter((entry) => entry.value)

  return (
    <div className="flex flex-col gap-4 px-4 py-3 text-sm">
      {details.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-foreground">{t("feedback.detail.errorDetails")}</p>
          <ul className="space-y-1 text-muted-foreground">
            {details.map((d) => (
              <li key={d.field}>
                <span className="font-medium text-foreground">{d.field}:</span>{" "}
                {d.options.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {otherTexts.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-foreground">{t("feedback.detail.additionalText")}</p>
          <ul className="space-y-1 text-muted-foreground">
            {otherTexts.map((entry) => (
              <li key={entry.label}>
                <span className="font-medium text-foreground">{entry.label}:</span>{" "}
                {entry.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.comment && (
        <div>
          <p className="mb-1 font-medium text-foreground">{t("feedback.detail.comment")}</p>
          <p className="text-muted-foreground">{feedback.comment}</p>
        </div>
      )}

      {feedback.status === "resolved" && feedback.resolved_at && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            {t("feedback.detail.resolvedAt")}:{" "}
            {formatRelativeTime(feedback.resolved_at, i18n.language)}
          </span>
          {feedback.resolved_by && (
            <span>
              {t("feedback.detail.resolvedBy")}: {feedback.resolved_by}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
