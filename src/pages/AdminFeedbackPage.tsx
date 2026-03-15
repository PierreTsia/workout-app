import { useTranslation } from "react-i18next"
import { useAdminFeedback } from "@/hooks/useAdminFeedback"
import { DataTable } from "@/components/admin/feedback-table/DataTable"

export function AdminFeedbackPage() {
  const { t } = useTranslation("admin")
  const { data: feedback, isLoading } = useAdminFeedback()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("feedback.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("feedback.description")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable data={feedback ?? []} />
      )}
    </div>
  )
}
