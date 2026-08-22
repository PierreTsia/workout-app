import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AmrapLabelProps {
  minutes: number
  className?: string
  /** `full` = cap + gloss. `inline` = cap only. `badge` = pill + minutes, gloss in a tooltip. */
  variant?: "full" | "inline" | "badge"
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

  if (variant === "badge") {
    return (
      <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0"
                aria-label={`${cap}. ${gloss}`}
              >
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 py-0 text-[10px] leading-none"
                >
                  AMRAP
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-56 text-xs leading-snug">
              {gloss}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {minutes} min
        </span>
      </span>
    )
  }

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
