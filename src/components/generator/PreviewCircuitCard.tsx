import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import type { GeneratedCircuit } from "@/types/generator"

interface PreviewCircuitCardProps {
  circuit: GeneratedCircuit
  index: number
  onRemove: (index: number) => void
}

export function PreviewCircuitCard({
  circuit,
  index,
  onRemove,
}: PreviewCircuitCardProps) {
  const { t } = useTranslation("generator")
  const { catalogName } = useCatalogLabels()
  const label = circuit.label?.trim() || t("circuit.fallbackLabel")
  const isAmrap = circuit.mode === "amrap"
  const capMinutes = circuit.capMinutes ?? 20

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-card p-3"
      data-testid="preview-circuit-card"
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t("circuit.badge")}</Badge>
            <span className="truncate text-sm font-medium">{label}</span>
          </div>
          {isAmrap ? (
            <AmrapLabel minutes={capMinutes} />
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("circuit.summary", {
                rounds: circuit.rounds,
                count: circuit.exercises.length,
                rest: circuit.restSeconds,
              })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onRemove(index)}
          aria-label={t("circuit.remove")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ul className="flex flex-col gap-1 border-t pt-2">
        {circuit.exercises.map((nested, i) => (
          <li
            key={`${nested.exercise.id}-${i}`}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="truncate">
              {nested.exercise.emoji} {catalogName(nested.exercise)}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {nested.amount}
              {nested.weightKg > 0 ? ` · ${nested.weightKg}kg` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
