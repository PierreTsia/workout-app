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

interface OpenSessionDialogProps {
  open: boolean
  onFinish: () => void
  onResume: () => void
}

/**
 * Start-guard dialog (#571): a session is already open, so the user must
 * Finish it (close with the last set, then start) or Resume it (reopen it and
 * drop the start). No third "start anyway" — that is the bug.
 */
export function OpenSessionDialog({
  open,
  onFinish,
  onResume,
}: OpenSessionDialogProps) {
  const { t } = useTranslation("workout")

  return (
    <Dialog open={open}>
      <DialogContent
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("openSession.title")}</DialogTitle>
          <DialogDescription>{t("openSession.body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onResume}>
            {t("openSession.resume")}
          </Button>
          <Button onClick={onFinish}>{t("openSession.finish")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
