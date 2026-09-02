import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const ROW_NAME_WIDTHS = ["w-36", "w-28", "w-44", "w-32", "w-40", "w-24"] as const

export function DayEditorSkeleton() {
  const { t } = useTranslation("common")

  return (
    <div
      role="status"
      aria-label={t("loading")}
      className="flex flex-col gap-4 p-4"
    >
      <Skeleton className="h-10 w-full" />
      <div className="flex flex-col gap-2" aria-hidden>
        {ROW_NAME_WIDTHS.map((nameWidth) => (
          <div
            key={nameWidth}
            className="flex items-center gap-2 rounded-lg border bg-card p-3"
          >
            <Skeleton className="h-5 w-5 shrink-0" />
            <Skeleton className="h-7 w-7 shrink-0 rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className={cn("h-4", nameWidth)} />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-8 w-8 shrink-0" />
            <Skeleton className="h-8 w-8 shrink-0" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row" aria-hidden>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
