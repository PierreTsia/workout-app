import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"
import { Button } from "@/components/ui/button"
import { isEnglish } from "@/lib/catalogLabels"
import { catalogDisplayName } from "@/lib/resolveBenchmark"
import type { CatalogPreviewRow } from "@/lib/previewCatalogCircuit"

interface CircuitSeedCardProps {
  seed: CatalogPreviewRow
  onSelect: () => void
  pending?: boolean
}

export function CircuitSeedCard({
  seed,
  onSelect,
  pending = false,
}: CircuitSeedCardProps) {
  const { t, i18n } = useTranslation("builder")
  const label = catalogDisplayName(seed.slug) ?? seed.slug ?? ""
  const tagline = isEnglish(i18n.language)
    ? (seed.tagline_en ?? seed.tagline_fr)
    : (seed.tagline_fr ?? seed.tagline_en)
  const isAmrap = seed.rx.mode === "amrap"
  const capMinutes =
    seed.rx.cap_seconds != null ? Math.round(seed.rx.cap_seconds / 60) : 20

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      aria-label={label}
      onClick={onSelect}
      className="h-auto w-full flex-col items-start gap-1 whitespace-normal px-3 py-3 text-left"
    >
      <span className="flex w-full items-center gap-2">
        <span className="truncate text-sm font-medium">{label}</span>
        {pending ? (
          <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin" />
        ) : null}
      </span>
      {isAmrap ? (
        <AmrapLabel minutes={capMinutes} variant="inline" />
      ) : (
        <span className="text-xs text-muted-foreground">
          {t("blockRounds", { count: 1 })}
        </span>
      )}
      {tagline ? (
        <span className="text-xs text-muted-foreground">{tagline}</span>
      ) : null}
    </Button>
  )
}
