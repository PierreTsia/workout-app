import { useState } from "react"
import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { RIR_TOGGLE_CLASSES } from "@/lib/rirStyles"

const DEFAULT_RIR = 2

interface SetInfo {
  setNumber: number
  reps: string
  weight: string
  unit: string
}

interface RirDrawerProps {
  open: boolean
  setInfo: SetInfo | null
  onConfirm: (rir: number) => void
}

export function RirDrawer({ open, setInfo, onConfirm }: RirDrawerProps) {
  const { t } = useTranslation("workout")
  const [selectedRir, setSelectedRir] = useState(DEFAULT_RIR)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onConfirm(selectedRir)
    }
  }

  function handleConfirm() {
    onConfirm(selectedRir)
  }

  const rirValues = ["4", "3", "2", "1", "0"] as const

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <div className="flex items-center justify-center gap-2">
            <DrawerTitle>{t("rir.title")}</DrawerTitle>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={t("rir.infoLabel")}
                >
                  <Info className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-sm">
                {t("rir.infoText")}
              </PopoverContent>
            </Popover>
          </div>
          {setInfo && (
            <DrawerDescription>
              {t("rir.setInfo", {
                setNumber: setInfo.setNumber,
                reps: setInfo.reps,
                weight: setInfo.weight,
                unit: setInfo.unit,
              })}
            </DrawerDescription>
          )}
        </DrawerHeader>

        <div className="flex flex-col items-center gap-4 px-4 pb-2">
          <span className="text-lg font-medium">
            {t("rir.moreReps", { count: selectedRir })}
          </span>

          <ToggleGroup
            type="single"
            value={String(selectedRir)}
            onValueChange={(v) => {
              if (v) setSelectedRir(Number(v))
            }}
            className="gap-3"
          >
            {rirValues.map((v) => (
              <div key={v} className="flex flex-col items-center gap-1">
                <ToggleGroupItem
                  value={v}
                  className={`h-12 w-12 rounded-full border-2 text-base font-semibold ${RIR_TOGGLE_CLASSES[v]}`}
                >
                  {v === "4" ? "4+" : v}
                </ToggleGroupItem>
                <span className="text-[10px] text-muted-foreground">
                  {t(`rir.label.${v}`)}
                </span>
              </div>
            ))}
          </ToggleGroup>
        </div>

        <DrawerFooter>
          <Button onClick={handleConfirm}>{t("rir.confirm")}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
