import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
import { useRevokePAT } from "@/hooks/useRevokePAT"
import type { PersonalAccessToken } from "@/types/personalAccessToken"

interface RevokePATDialogProps {
  token: PersonalAccessToken | null
  onClose: () => void
}

export function RevokePATDialog({ token, onClose }: RevokePATDialogProps) {
  const { t } = useTranslation("api-tokens")
  const revoke = useRevokePAT()

  const open = token != null

  async function handleConfirm() {
    if (!token) return
    try {
      await revoke.mutateAsync(token.id)
      toast.success(t("revokeSuccess"))
      onClose()
    } catch {
      toast.error(t("revokeError"))
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !revoke.isPending) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("revokeDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("revokeDialogDescription", { name: token?.name ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.isPending}>
            {t("revokeCancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleConfirm}
            disabled={revoke.isPending}
          >
            {t("revokeConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
