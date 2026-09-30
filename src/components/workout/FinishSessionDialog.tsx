import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FinishSessionDialogProps {
  open: boolean
  /** Already-translated confirm body from `useFinishSessionAttempt`. */
  body: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * The one finish confirmation, rendered by `WorkoutPage` (#571). Moved out of
 * `SessionNav` so the bottom nav and the header share a single dialog.
 */
export function FinishSessionDialog({
  open,
  body,
  onOpenChange,
  onConfirm,
}: FinishSessionDialogProps) {
  const { t } = useTranslation("workout")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("finishSessionTitle")}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:cancel")}
          </Button>
          <Button onClick={onConfirm}>{t("finish")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
