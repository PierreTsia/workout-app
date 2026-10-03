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
import { Input } from "@nomosui/react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DEVIATION_REASONS,
  isDeviationReason,
  showsWeightAxis,
  type DeviationReason,
} from "@/lib/deviationCapture"

export interface DeviationSetInfo {
  setNumber: number
  unit: string
  /** Did the weight deviate? Drives the prompt copy. */
  weightChanged: boolean
  prescribed: string
  actual: string
  repsChanged: boolean
  prescribedReps: string | null
  actualReps: string | null
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

  const showWeight = setInfo ? showsWeightAxis(setInfo) : false

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resolve(null, null)
      }}
    >
      <DrawerContent aria-label={t("deviation.sheetLabel")}>
        <DrawerHeader>
          <DrawerTitle>
            {setInfo?.weightChanged
              ? t("deviation.loadPrompt")
              : t("deviation.loadPromptReps")}
          </DrawerTitle>
          {setInfo && showWeight && (
            <DrawerDescription>
              {t("deviation.setInfo", {
                setNumber: setInfo.setNumber,
                prescribed: setInfo.prescribed,
                actual: setInfo.actual,
                unit: setInfo.unit,
              })}
            </DrawerDescription>
          )}
          {setInfo?.repsChanged && (
            <DrawerDescription>
              {t("deviation.setInfoReps", {
                prescribed: setInfo.prescribedReps,
                actual: setInfo.actualReps,
              })}
            </DrawerDescription>
          )}
        </DrawerHeader>

        <ToggleGroup
          type="single"
          value={reason ?? ""}
          onValueChange={(value) =>
            setReason(isDeviationReason(value) ? value : null)
          }
          aria-label={t("deviation.reasonGroupLabel")}
          className="flex flex-wrap gap-2 px-4 pb-2"
        >
          {DEVIATION_REASONS.map((code) => (
            <ToggleGroupItem
              key={code}
              value={code}
              className={
                reason === code
                  ? "rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground"
              }
            >
              {t(`deviation.reason.${code}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

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
