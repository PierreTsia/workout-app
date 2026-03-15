import { MoreHorizontal, Eye, CheckCircle2, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAdminUpdateFeedbackStatus } from "@/hooks/useAdminUpdateFeedbackStatus"
import type { FeedbackStatus } from "@/types/database"

interface StatusDropdownProps {
  feedbackId: string
  currentStatus: FeedbackStatus
  adminEmail: string
}

export function StatusDropdown({ feedbackId, currentStatus, adminEmail }: StatusDropdownProps) {
  const { t } = useTranslation("admin")
  const mutation = useAdminUpdateFeedbackStatus()

  function handleStatusChange(status: FeedbackStatus) {
    mutation.mutate({ id: feedbackId, status, adminEmail })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {currentStatus !== "in_review" && (
          <DropdownMenuItem onClick={() => handleStatusChange("in_review")}>
            <Eye className="mr-2 h-4 w-4" />
            {t("feedback.actions.markInReview")}
          </DropdownMenuItem>
        )}
        {currentStatus !== "resolved" && (
          <DropdownMenuItem onClick={() => handleStatusChange("resolved")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t("feedback.actions.markResolved")}
          </DropdownMenuItem>
        )}
        {currentStatus !== "pending" && (
          <DropdownMenuItem onClick={() => handleStatusChange("pending")}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("feedback.actions.reopen")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
