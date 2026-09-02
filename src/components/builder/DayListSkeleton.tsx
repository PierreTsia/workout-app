import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const DAY_NAME_WIDTHS = ["w-24", "w-20", "w-28"] as const

export function DayListSkeleton() {
  const { t } = useTranslation("common")

  return (
    <div
      role="status"
      aria-label={t("loading")}
      className="flex flex-col gap-3 p-4"
    >
      <div className="flex flex-col gap-3" aria-hidden>
        {DAY_NAME_WIDTHS.map((nameWidth) => (
          <div
            key={nameWidth}
            className="flex items-center gap-3 rounded-lg border bg-card p-4"
          >
            <Skeleton className="h-5 w-5 shrink-0" />
            <Skeleton className="h-8 w-8 shrink-0 rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className={cn("h-4", nameWidth)} />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-8 shrink-0" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
