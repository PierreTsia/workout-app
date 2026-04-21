import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Share, Plus, CheckCircle2 } from "lucide-react"

interface IOSInstallModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IOSInstallModal({ open, onOpenChange }: IOSInstallModalProps) {
  const { t } = useTranslation("common")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("iosInstallTitle")}</DialogTitle>
          <DialogDescription>{t("iosInstallSubtitle")}</DialogDescription>
        </DialogHeader>

        <ol className="mt-4 flex flex-col gap-4">
          <li className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Share className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">{t("iosInstallStep1Title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("iosInstallStep1Desc")}
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">{t("iosInstallStep2Title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("iosInstallStep2Desc")}
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">{t("iosInstallStep3Title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("iosInstallStep3Desc")}
              </p>
            </div>
          </li>
        </ol>

        <Button className="mt-4 w-full" onClick={() => onOpenChange(false)}>
          {t("close")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
