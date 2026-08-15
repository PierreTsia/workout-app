import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"

interface AmrapLabelProps {
  minutes: number
}

/** Sole renderer of the word AMRAP — always badge + gloss, never naked. */
export function AmrapLabel({ minutes }: AmrapLabelProps) {
  const { t } = useTranslation("builder")
  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline">{`AMRAP ${minutes} min`}</Badge>
      <p className="text-xs text-muted-foreground">{t("amrapGloss")}</p>
    </div>
  )
}
