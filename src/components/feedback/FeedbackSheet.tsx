import { useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { CircleCheck } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { FeedbackForm } from "./FeedbackForm"
import type { FeedbackSourceScreen } from "./schema"

interface FeedbackSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exerciseId: string
  sourceScreen: FeedbackSourceScreen
  onSuccess: () => void
}

export function FeedbackSheet({
  open,
  onOpenChange,
  exerciseId,
  sourceScreen,
  onSuccess,
}: FeedbackSheetProps) {
  const { t } = useTranslation("feedback")
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSuccess = useCallback(() => {
    setShowSuccess(true)
  }, [])

  const handleAnimationEnd = useCallback(() => {
    setShowSuccess(false)
    onSuccess()
    onOpenChange(false)
  }, [onSuccess, onOpenChange])

  useEffect(() => {
    if (!open) setShowSuccess(false)
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[92%] flex-col overflow-hidden p-0 sm:w-3/4"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {showSuccess ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4 px-6 animate-success-flash"
            onAnimationEnd={handleAnimationEnd}
          >
            <CircleCheck className="h-16 w-16 text-primary" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-foreground">
              {t("successToast")}
            </p>
          </div>
        ) : (
          <>
            <SheetHeader className="shrink-0 px-6 pt-6 pb-2">
              <SheetTitle>{t("title")}</SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col">
              <FeedbackForm
                exerciseId={exerciseId}
                sourceScreen={sourceScreen}
                onSuccess={handleSuccess}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
