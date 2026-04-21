import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type ExerciseEditScope = "session" | "permanent"

interface ExerciseEditScopeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  swapHint?: boolean
  onChoose: (scope: ExerciseEditScope) => void
  isPending?: boolean
}

export function ExerciseEditScopeDialog({
  open,
  onOpenChange,
  title,
  description,
  swapHint,
  onChoose,
  isPending,
}: ExerciseEditScopeDialogProps) {
  const { t } = useTranslation("workout")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="flex flex-col gap-2">
            <span className="block">{description}</span>
            {swapHint ? (
              <span className="block text-xs">{t("preSession.scopeSwapHistoryHint")}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={isPending}
            onClick={() => onChoose("session")}
          >
            {t("preSession.scopeSessionOnly")}
          </Button>
          <Button
            type="button"
            className="w-full"
            disabled={isPending}
            onClick={() => onChoose("permanent")}
          >
            {t("preSession.scopePermanent")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("common:cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
