import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { BenchmarkStoryHeader } from "@/components/history/BenchmarkStoryHeader"
import { CircuitRxList } from "@/components/library/CircuitRxList"
import { Button } from "@/components/ui/button"
import { useBenchmarkSeed } from "@/hooks/useBenchmarkSeed"
import { useExerciseBatch } from "@/hooks/useExerciseBatch"
import type { BenchmarkCopy } from "@/hooks/useBenchmarkCompletionHistory"
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
  const { t } = useTranslation("library")
  const { slug } = useParams<{ slug: string }>()
  const trimmed = slug?.trim() ?? ""
  const { data: seed, isLoading } = useBenchmarkSeed(trimmed)

  const exerciseIds = (seed?.rx.exercises ?? []).map((ex) => ex.exercise_id)
  const { data: exercises } = useExerciseBatch(exerciseIds)
  const byId = new Map((exercises ?? []).map((ex) => [ex.id, ex]))

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
      <CircuitRxList exercises={seed.rx.exercises} byId={byId} />
    </div>
  )
}
