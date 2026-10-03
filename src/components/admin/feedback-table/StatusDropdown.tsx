import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nomosui/react"
import { useAdminUpdateFeedbackStatus } from "@/hooks/useAdminUpdateFeedbackStatus"
import type { FeedbackStatus } from "@/types/database"
import { FEEDBACK_STATUSES, feedbackStatusLabel } from "./facets"

interface StatusDropdownProps {
  feedbackId: string
  currentStatus: FeedbackStatus
  adminEmail: string
}

const isFeedbackStatus = (value: string): value is FeedbackStatus =>
  FEEDBACK_STATUSES.some((status) => status === value)

/**
 * The status transition, on a core Select: the trigger shows the current
 * status, picking another fires the mutation (in_review / resolved / reopen).
 */
export function StatusDropdown({
  feedbackId,
  currentStatus,
  adminEmail,
}: StatusDropdownProps) {
  const { t } = useTranslation("admin")
  const mutation = useAdminUpdateFeedbackStatus()

  return (
    <Select
      value={currentStatus}
      onValueChange={(value) => {
        if (isFeedbackStatus(value) && value !== currentStatus) {
          mutation.mutate({ id: feedbackId, status: value, adminEmail })
        }
      }}
    >
      <SelectTrigger
        className="h-8 w-[130px]"
        aria-label={t("feedback.columns.status")}
        onClick={(event) => event.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FEEDBACK_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {feedbackStatusLabel(t, status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
