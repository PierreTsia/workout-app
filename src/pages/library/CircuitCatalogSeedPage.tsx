import { Link, useParams } from "react-router-dom"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Loader2 } from "lucide-react"
import { ExerciseDetailSheet } from "@/components/generator/ExerciseDetailSheet"
import { AmrapRunRow } from "@/components/history/AmrapRunRow"
import { BenchmarkStoryHeader } from "@/components/history/BenchmarkStoryHeader"
import { CircuitRxList } from "@/components/library/CircuitRxList"
import { Button } from "@/components/ui/button"
import {
  useBenchmarkCompletionHistory,
  type BenchmarkCopy,
} from "@/hooks/useBenchmarkCompletionHistory"
import { useBenchmarkSeed } from "@/hooks/useBenchmarkSeed"
import { useExerciseBatch } from "@/hooks/useExerciseBatch"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import type { CatalogSeedRow } from "@/lib/previewCatalogCircuit"

function seedCopy(seed: CatalogSeedRow): BenchmarkCopy {
  return {
    slug: seed.slug,
    label: seed.label,
    tagline_fr: seed.tagline_fr,
    tagline_en: seed.tagline_en,
    story_fr: seed.story_fr,
    story_en: seed.story_en,
    reference: seed.reference,
  }
}

function NotFound({ message, back }: { message: string; back: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-8 pt-6 text-center">
      <p className="text-muted-foreground">{message}</p>
      <Button asChild variant="secondary">
        <Link to="/library/circuits">{back}</Link>
      </Button>
    </div>
  )
}

export function CircuitCatalogSeedPage() {
  const { t } = useTranslation(["library", "history"])
  const { slug } = useParams<{ slug: string }>()
  const trimmed = slug?.trim() ?? ""
  const { data: seed, isLoading } = useBenchmarkSeed(trimmed)
  const isOnline = useOnlineStatus()
  const {
    data: history,
    isLoading: historyLoading,
    isError: historyError,
    refetch,
  } = useBenchmarkCompletionHistory(true, seed?.id)

  const exerciseIds = (seed?.rx.exercises ?? []).map((ex) => ex.exercise_id)
  const { data: exercises } = useExerciseBatch(exerciseIds)
  const byId = new Map((exercises ?? []).map((ex) => [ex.id, ex]))
  const amrapViews = history?.amrapViews ?? []
  const [infoExerciseId, setInfoExerciseId] = useState<string | null>(null)
  const infoExercise =
    infoExerciseId == null ? null : (byId.get(infoExerciseId) ?? null)

  if (trimmed === "") {
    return <NotFound message={t("circuitNotFound")} back={t("circuitBrowseBack")} />
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12 text-muted-foreground">
        {t("circuitDetailLoading")}
      </div>
    )
  }

  if (!seed) {
    return <NotFound message={t("circuitNotFound")} back={t("circuitBrowseBack")} />
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-8">
      <div className="flex items-center gap-3 pt-1">
        <Link
          to="/library/circuits"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("circuitBrowseBack")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight">{seed.label}</h1>
      </div>
      <BenchmarkStoryHeader copy={seedCopy(seed)} />
      <CircuitRxList
        exercises={seed.rx.exercises}
        byId={byId}
        onSelectExercise={setInfoExerciseId}
      />
      <ExerciseDetailSheet
        exercise={infoExercise}
        open={infoExercise != null}
        onOpenChange={(open) => {
          if (!open) setInfoExerciseId(null)
        }}
      />
      <section>
        {!isOnline ? (
          <p className="text-sm text-muted-foreground">{t("history:circuit.offline")}</p>
        ) : historyLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <span className="text-sm">{t("history:circuit.loading")}</span>
          </div>
        ) : historyError ? (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-sm text-destructive">{t("history:circuit.loadError")}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              {t("history:circuit.retry")}
            </Button>
          </div>
        ) : amrapViews.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("history:circuit.noPrYet")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {amrapViews.map((view) => (
              <AmrapRunRow key={view.sessionId} view={view} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
