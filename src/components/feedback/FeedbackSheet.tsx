import { useTranslation } from "react-i18next"
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

  const handleSuccess = () => {
    onSuccess()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col overflow-hidden p-0"
      >
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
      </SheetContent>
    </Sheet>
  )
}
