import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const DAY_NAME_WIDTHS = ["w-20", "w-16", "w-24"] as const

export function ProgramPageSkeleton() {
  const { t } = useTranslation("common")

  return (
    <div
      role="status"
      aria-label={t("loading")}
      className="flex flex-1 flex-col gap-6 px-4 pb-8"
    >
      <div className="flex flex-col items-center gap-2 pt-1" aria-hidden>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-36" />
      </div>

      <Card aria-hidden>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="mx-auto h-8 w-10" />
            <Skeleton className="mx-auto h-8 w-10" />
            <Skeleton className="mx-auto h-8 w-10" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3" aria-hidden>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg lg:col-span-3" />
      </div>

      <div className="grid gap-3" aria-hidden>
        {DAY_NAME_WIDTHS.map((nameWidth) => (
          <div
            key={nameWidth}
            className="flex items-center gap-3 rounded-lg border bg-card p-4"
          >
            <Skeleton className="h-8 w-8 shrink-0 rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className={cn("h-4", nameWidth)} />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
