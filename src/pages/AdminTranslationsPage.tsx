import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react"
import {
  Badge,
  Button,
  EmptyState,
  Heading,
  ProgressBar,
  Skeleton,
  Text,
} from "@nomosui/react"
import { TranslationReviewCard } from "@/components/admin/translations/TranslationReviewCard"
import { useTranslationReviewQueue } from "@/hooks/useTranslationReviewQueue"

export function AdminTranslationsPage() {
  const { t } = useTranslation("admin")
  const { data: queue, isLoading } = useTranslationReviewQueue()
  const [index, setIndex] = useState(0)

  const total = queue?.length ?? 0
  // Clamped rather than reset, and deliberately not advanced after a decision:
  // the decided row leaves the queue on the next fetch, so the same index lands
  // on the row that followed it. Only the last row of the queue needs the clamp.
  const position = Math.min(index, Math.max(total - 1, 0))
  const row = total > 0 ? queue![position] : null

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div>
        <Heading level={1}>{t("translations.title")}</Heading>
        <Text size="body" className="text-muted-foreground">
          {t("translations.description")}
        </Text>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-8 w-8" />
        </div>
      ) : row === null ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<PartyPopper className="h-12 w-12 text-primary" />}
            title={t("translations.allDone")}
            description={t("translations.allDoneHint")}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">{t("translations.backToAdmin")}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <ProgressBar
              value={position + 1}
              max={total}
              label={t("translations.progressLabel")}
              className="flex-1"
            />
            <Badge
              variant="outline"
              className="shrink-0 tabular-nums text-muted-foreground"
            >
              {position + 1}/{total}
            </Badge>
          </div>

          <TranslationReviewCard
            key={row.id}
            row={row}
            onSkip={() => setIndex(position + 1)}
          />

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
