import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface AmrapLabelProps {
  minutes: number
  className?: string
  /** `full` = cap + gloss. `inline` = cap only, same slot as "2 tours" on BlockCard. */
  variant?: "full" | "inline"
}

/** Sole renderer of the word AMRAP — never naked. Gloss is visual on `full`, a11y on `inline`. */
export function AmrapLabel({
  minutes,
  className,
  variant = "full",
}: AmrapLabelProps) {
  const { t } = useTranslation("builder")
  const cap = `AMRAP ${minutes} min`
  const gloss = t("amrapGloss")

  if (variant === "inline") {
    return (
      <span
        className={cn("shrink-0 text-xs text-muted-foreground", className)}
        aria-label={`${cap}. ${gloss}`}
      >
        {cap}
      </span>
    )
  }

  return (
    <span className={cn("block truncate text-xs text-muted-foreground", className)}>
      <span className="font-medium text-secondary-foreground">{cap}</span>
      {" · "}
      <span>{gloss}</span>
    </span>
  )
}
