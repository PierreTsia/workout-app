import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ActivateConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isSessionActive: boolean
  isPending: boolean
}

export function ActivateConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isSessionActive,
  isPending,
}: ActivateConfirmDialogProps) {
  const { t } = useTranslation("library")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("switchProgramTitle")}</DialogTitle>
          <DialogDescription>{t("switchProgramDescription")}</DialogDescription>
        </DialogHeader>

        {isSessionActive && (
          <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t("sessionActiveWarning")}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("common:cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={isSessionActive || isPending}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
