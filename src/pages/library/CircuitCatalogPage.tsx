import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Loader2 } from "lucide-react"
import { CircuitCatalogCard } from "@/components/library/CircuitCatalogCard"
import { useBenchmarkSeeds } from "@/hooks/useBenchmarkSeeds"

export function CircuitCatalogPage() {
  const { t } = useTranslation("library")
  const navigate = useNavigate()
  const { data: seeds, isLoading, isError } = useBenchmarkSeeds(true)

  const catalogSeeds = (seeds ?? []).flatMap((seed) => {
    const slug = seed.slug
    if (slug == null || slug.trim() === "") return []
    return [{ seed, slug }]
  })

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("backToWorkout")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{t("circuitsBrowseTitle")}</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="sr-only">{t("circuitsBrowseLoading")}</span>
          </div>
        ) : isError ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("circuitsBrowseError")}
          </p>
        ) : catalogSeeds.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("circuitsBrowseEmpty")}
          </p>
        ) : (
          catalogSeeds.map(({ seed, slug }) => (
            <CircuitCatalogCard
              key={seed.id}
              seed={seed}
              to={`/library/circuits/${slug}`}
            />
          ))
        )}
      </div>
    </div>
  )
}
