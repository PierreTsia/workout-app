import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"

export function CircuitCatalogSeedPage() {
  const { t } = useTranslation("library")
  const { slug } = useParams<{ slug: string }>()
  const heading = slug && slug.trim() !== "" ? slug : t("circuitsBrowseTitle")

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-8">
      <div className="flex items-center gap-3 pt-1">
        <Link
          to="/library/circuits"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("circuitsBrowseTitle")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight">{heading}</h1>
      </div>
    </div>
  )
}
