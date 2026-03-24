import { useSetAtom } from "jotai"
import { useTranslation } from "react-i18next"
import { sessionAtom } from "@/store/atoms"
import { resumeSessionFromPause } from "@/lib/session"
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

interface PausedWorkoutAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PausedWorkoutAlertDialog({
  open,
  onOpenChange,
}: PausedWorkoutAlertDialogProps) {
  const { t } = useTranslation("workout")
  const setSession = useSetAtom(sessionAtom)

  function resume() {
    setSession((prev) => resumeSessionFromPause(prev))
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pausedWorkoutTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("pausedWorkoutDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={resume}>{t("resume")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
