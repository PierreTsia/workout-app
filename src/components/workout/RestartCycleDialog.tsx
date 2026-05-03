import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface MissingDay {
  id: string
  label: string
}

interface RestartCycleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  completedCount: number
  totalDays: number
  missingDays: MissingDay[]
  currentDayLabel: string
  onConfirm: () => void
  isPending: boolean
}

export function RestartCycleDialog({
  open,
  onOpenChange,
  completedCount,
  totalDays,
  missingDays,
  currentDayLabel,
  onConfirm,
  isPending,
}: RestartCycleDialogProps) {
  const { t } = useTranslation("workout")

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("abandonCycle.dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("abandonCycle.dialogIntro", {
              completed: completedCount,
              total: totalDays,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {missingDays.length > 0 && (
          <div className="text-sm">
            <p className="mb-1 font-medium text-foreground">
              {t("abandonCycle.missingHeading")}
            </p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {missingDays.map((d) => (
                <li key={d.id}>{d.label}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {t("abandonCycle.dialogOutro", { dayLabel: currentDayLabel })}
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("abandonCycle.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={isPending}
          >
            {t("abandonCycle.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
