import { Layers, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"
import { Button } from "@/components/ui/button"
import { isEnglish } from "@/lib/catalogLabels"
import type { CatalogPreviewRow } from "@/lib/previewCatalogCircuit"

interface CircuitSeedCardProps {
  seed: CatalogPreviewRow
  onSelect: () => void
  pending?: boolean
  locked?: boolean
}

export function CircuitSeedCard({
  seed,
  onSelect,
  pending = false,
  locked = false,
}: CircuitSeedCardProps) {
  const { t, i18n } = useTranslation("builder")
  const label = seed.label
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
      disabled={pending || locked}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className="h-auto w-full items-start justify-start gap-3 whitespace-normal border-primary/25 bg-card px-3 py-3 text-left shadow-xs hover:border-primary/40 hover:bg-accent/50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Layers className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex w-full items-center gap-2">
          <span className="truncate text-base font-semibold tracking-tight">
            {label}
          </span>
          {pending ? (
            <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin" />
          ) : null}
        </span>
        {isAmrap ? (
          <AmrapLabel minutes={capMinutes} />
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("blockRounds", { count: 1 })}
          </span>
        )}
        {tagline ? (
          <span className="text-xs text-muted-foreground">{tagline}</span>
        ) : null}
      </span>
    </Button>
  )
}
