import { useTranslation } from "react-i18next"
import { useAdminExercises } from "@/hooks/useAdminExercises"
import { DataTable } from "@/components/admin/exercises-table/DataTable"

export function AdminExercisesPage() {
  const { t } = useTranslation("admin")
  const { data: exercises, isLoading } = useAdminExercises()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("exercises")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("exercisesDescription")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <DataTable data={exercises ?? []} />
      )}
    </div>
  )
}
