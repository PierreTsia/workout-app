import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FeedbackSheet } from "./FeedbackSheet"
import type { FeedbackSourceScreen } from "./schema"

interface FeedbackTriggerProps {
  exerciseId: string
  sourceScreen: FeedbackSourceScreen
  variant?: "icon" | "button"
  /** `neutral`: secondary button for toolbars; `alert`: ghost + destructive tint (default). */
  buttonTone?: "alert" | "neutral"
  className?: string
}

export function FeedbackTrigger({
  exerciseId,
  sourceScreen,
  variant = "icon",
  buttonTone = "alert",
  className,
}: FeedbackTriggerProps) {
  const { t } = useTranslation("feedback")
  const [open, setOpen] = useState(false)

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center justify-center rounded-md p-1 text-destructive transition-colors hover:text-destructive/80 ${className ?? ""}`}
          aria-label={t("reportButton")}
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      ) : (
        <Button
          type="button"
          variant={buttonTone === "neutral" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setOpen(true)}
          className={cn(
            buttonTone === "neutral"
              ? "font-medium"
              : "text-destructive hover:text-destructive/80 hover:bg-destructive/10",
            className,
          )}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          {t("reportButton")}
        </Button>
      )}
      <FeedbackSheet
        open={open}
        onOpenChange={setOpen}
        exerciseId={exerciseId}
        sourceScreen={sourceScreen}
        onSuccess={() => setOpen(false)}
      />
    </>
  )
}
