import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PartyPopper } from "lucide-react"
import {
  Button,
  EmptyState,
  Heading,
  ProgressBar,
  Skeleton,
  Text,
} from "@nomosui/react"
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
        <Heading level={1}>{t("enrichment.title")}</Heading>
        <Text size="body" className="text-muted-foreground">
          {t("enrichment.description")}
        </Text>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="h-8 w-8" />
        </div>
      ) : remaining === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<PartyPopper className="h-12 w-12 text-primary" />}
            title={t("enrichment.allDone")}
            description={t("enrichment.allDoneHint")}
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">{t("enrichment.backToAdmin")}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <ProgressBar value={done} max={total} className="flex-1" />
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
