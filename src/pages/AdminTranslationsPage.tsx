import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight, Loader2, PartyPopper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TranslationReviewCard } from "@/components/admin/translations/TranslationReviewCard"
import { useTranslationReviewQueue } from "@/hooks/useTranslationReviewQueue"

export function AdminTranslationsPage() {
  const { t } = useTranslation("admin")
  const { data: queue, isLoading } = useTranslationReviewQueue()
  const [index, setIndex] = useState(0)

  const total = queue?.length ?? 0
  // Clamped rather than reset: the queue is read-only in this ticket, so the
  // only way the index can outrun it is a refetch shrinking the list.
  const position = Math.min(index, Math.max(total - 1, 0))
  const row = total > 0 ? queue![position] : null

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">{t("translations.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("translations.description")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : row === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <PartyPopper className="h-12 w-12 text-primary" />
          <div>
            <p className="text-lg font-semibold">{t("translations.allDone")}</p>
            <p className="text-sm text-muted-foreground">
              {t("translations.allDoneHint")}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin">{t("translations.backToAdmin")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${((position + 1) / total) * 100}%` }}
              />
            </div>
            <Badge
              variant="outline"
              className="shrink-0 tabular-nums text-muted-foreground"
            >
              {position + 1}/{total}
            </Badge>
          </div>

          <TranslationReviewCard key={row.id} row={row} />

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setIndex(position - 1)}
              disabled={position === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("translations.previous")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => setIndex(position + 1)}
              disabled={position >= total - 1}
            >
              {t("translations.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
