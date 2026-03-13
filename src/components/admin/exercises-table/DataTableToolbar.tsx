import type { Table } from "@tanstack/react-table"
import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import type { Exercise } from "@/types/database"

interface DataTableToolbarProps {
  table: Table<Exercise>
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  reviewFilter: string
  onReviewFilterChange: (value: string) => void
  totalCount: number
  reviewedCount: number
}

export function DataTableToolbar({
  globalFilter,
  onGlobalFilterChange,
  reviewFilter,
  onReviewFilterChange,
  totalCount,
  reviewedCount,
}: DataTableToolbarProps) {
  const { t } = useTranslation("admin")

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(["all", "not_reviewed", "reviewed"] as const).map((value) => (
            <button
              key={value}
              onClick={() => onReviewFilterChange(value)}
              className={
                "px-3 py-1.5 text-xs font-medium transition-colors " +
                (reviewFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/60")
              }
            >
              {value === "all"
                ? t("allReviewStatus")
                : value === "reviewed"
                  ? t("reviewed")
                  : t("notReviewed")}
            </button>
          ))}
        </div>
        <div className="hidden text-xs text-muted-foreground sm:block">
          {t("exerciseCount", { count: totalCount })} &middot;{" "}
          {t("reviewedCount", { count: reviewedCount })}
        </div>
      </div>
    </div>
  )
}
