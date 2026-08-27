import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

type NewCircuitRowProps = {
  onSelect: () => void
}

export function NewCircuitRow({ onSelect }: NewCircuitRowProps) {
  const { t } = useTranslation("builder")

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onSelect}
      aria-label={t("newCircuit")}
      className="h-auto w-full items-start justify-start gap-3 whitespace-normal px-3 py-3 text-left shadow-xs"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Plus className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-base font-semibold tracking-tight">
          {t("newCircuit")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("newCircuitHint")}
        </span>
      </span>
    </Button>
  )
}
