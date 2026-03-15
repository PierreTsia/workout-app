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

const DEFAULT_RIR = 2

const RIR_COLORS: Record<string, string> = {
  "0": "border-red-500 text-red-400 data-[state=on]:bg-red-500 data-[state=on]:text-white",
  "1": "border-orange-500 text-orange-400 data-[state=on]:bg-orange-500 data-[state=on]:text-white",
  "2": "border-yellow-500 text-yellow-400 data-[state=on]:bg-yellow-500 data-[state=on]:text-white",
  "3": "border-green-500 text-green-400 data-[state=on]:bg-green-500 data-[state=on]:text-white",
  "4": "border-blue-500 text-blue-400 data-[state=on]:bg-blue-500 data-[state=on]:text-white",
}

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
                  className={`h-12 w-12 rounded-full border-2 text-base font-semibold ${RIR_COLORS[v]}`}
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
