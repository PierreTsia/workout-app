import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Loader2, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EnrichmentCard } from "@/components/admin/enrichment/EnrichmentCard"
import {
  useExercisesNeedingImages,
  useExerciseTotalCount,
} from "@/hooks/useExercisesNeedingImages"

export function AdminEnrichmentPage() {
  const { t } = useTranslation("admin")
  const { data: exercises, isLoading } = useExercisesNeedingImages()
  const { data: totalCount } = useExerciseTotalCount()

  const remaining = exercises?.length ?? 0
  const total = totalCount ?? remaining
  const done = total - remaining

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("enrichment.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("enrichment.description")}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : remaining === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <PartyPopper className="h-12 w-12 text-primary" />
          <div>
            <p className="text-lg font-semibold">{t("enrichment.allDone")}</p>
            <p className="text-sm text-muted-foreground">{t("enrichment.allDoneHint")}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin">{t("enrichment.backToAdmin")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
              />
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
              {done}/{total}
            </span>
          </div>

          <EnrichmentCard exercise={exercises![0]} />
        </>
      )}
    </div>
  )
}
