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
import type { RecentOrphan } from "@/hooks/useOrphanSessionClose"

interface OrphanSessionPromptProps {
  /** The recent orphan to offer, or `null` to hide the prompt. */
  orphan: RecentOrphan | null
  onResume: () => void
  onFinish: () => void
  onDismiss: () => void
}

/**
 * App-open offer for a recent orphan session (#571): Resume reopens it,
 * Finish closes it with the last set, and dismissing (X) leaves the row open.
 * Driven by `useOrphanSessionClose` through `AppShell`.
 */
export function OrphanSessionPrompt({
  orphan,
  onResume,
  onFinish,
  onDismiss,
}: OrphanSessionPromptProps) {
  const { t } = useTranslation("workout")

  return (
    <Dialog
      open={orphan != null}
      onOpenChange={(open) => {
        if (!open) onDismiss()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("orphanPrompt.title")}</DialogTitle>
          <DialogDescription>{t("orphanPrompt.body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={onFinish}
          >
            {t("openSession.finish")}
          </Button>
          <Button size="lg" className="flex-1" onClick={onResume}>
            {t("openSession.resume")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
