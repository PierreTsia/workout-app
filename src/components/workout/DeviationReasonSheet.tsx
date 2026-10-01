import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DEVIATION_REASONS,
  type DeviationReason,
} from "@/lib/deviationCapture"

export interface DeviationSetInfo {
  setNumber: number
  prescribed: string
  actual: string
  unit: string
}

interface DeviationReasonSheetProps {
  open: boolean
  setInfo: DeviationSetInfo | null
  /** Resolves the capture: a reason (or null for a skip) and an optional note. */
  onResolve: (reason: DeviationReason | null, note: string | null) => void
}

/**
 * One-tap reason for a load Deviation (S1, T266). Never blocks: the rest timer
 * keeps running behind it, and Skip persists the event with a null reason.
 */
export function DeviationReasonSheet({
  open,
  setInfo,
  onResolve,
}: DeviationReasonSheetProps) {
  const { t } = useTranslation("workout")
  const [reason, setReason] = useState<DeviationReason | null>(null)
  const [note, setNote] = useState("")

  const canSave = reason !== null || note.trim() !== ""

  function resolve(next: DeviationReason | null, nextNote: string | null) {
    onResolve(next, nextNote)
    setReason(null)
    setNote("")
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resolve(null, null)
      }}
    >
      <DrawerContent aria-label={t("deviation.sheetLabel")}>
        <DrawerHeader>
          <DrawerTitle>{t("deviation.loadPrompt")}</DrawerTitle>
          {setInfo && (
            <DrawerDescription>
              {t("deviation.setInfo", {
                setNumber: setInfo.setNumber,
                prescribed: setInfo.prescribed,
                actual: setInfo.actual,
                unit: setInfo.unit,
              })}
            </DrawerDescription>
          )}
        </DrawerHeader>

        <div
          role="group"
          aria-label={t("deviation.reasonGroupLabel")}
          className="flex flex-wrap gap-2 px-4 pb-2"
        >
          {DEVIATION_REASONS.map((code) => {
            const selected = reason === code
            return (
              <button
                key={code}
                type="button"
                aria-pressed={selected}
                onClick={() => setReason(selected ? null : code)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-foreground hover:border-primary/50"
                }`}
              >
                {t(`deviation.reason.${code}`)}
              </button>
            )
          })}
        </div>

        <div className="px-4 pt-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("deviation.notePlaceholder")}
          />
        </div>

        <DrawerFooter>
          <Button onClick={() => resolve(reason, note.trim() || null)} disabled={!canSave}>
            {t("deviation.save")}
          </Button>
          <Button variant="ghost" onClick={() => resolve(null, null)}>
            {t("skip")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
