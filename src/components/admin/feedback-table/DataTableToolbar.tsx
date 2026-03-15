import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"

interface DataTableToolbarProps {
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  totalCount: number
  pendingCount: number
}

const STATUS_OPTIONS = ["all", "pending", "in_review", "resolved"] as const

export function DataTableToolbar({
  globalFilter,
  onGlobalFilterChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  pendingCount,
}: DataTableToolbarProps) {
  const { t } = useTranslation("admin")

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("feedback.searchPlaceholder")}
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {STATUS_OPTIONS.map((value) => (
            <button
              key={value}
              onClick={() => onStatusFilterChange(value)}
              className={
                "px-3 py-1.5 text-xs font-medium transition-colors " +
                (statusFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/60")
              }
            >
              {value === "all"
                ? t("feedback.allStatus")
                : value === "pending"
                  ? t("feedback.pending")
                  : value === "in_review"
                    ? t("feedback.inReview")
                    : t("feedback.resolved")}
            </button>
          ))}
        </div>
        <div className="hidden text-xs text-muted-foreground sm:block">
          {t("feedback.totalCount", { count: totalCount })} &middot;{" "}
          {t("feedback.pendingCount", { count: pendingCount })}
        </div>
      </div>
    </div>
  )
}
