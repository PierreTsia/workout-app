import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { BodyMap } from "./BodyMap"
import type { IExerciseData } from "react-body-highlighter"

interface SessionHeatmapProps {
  data: IExerciseData[]
  defaultOpen?: boolean
}

export function SessionHeatmap({
  data,
  defaultOpen = false,
}: SessionHeatmapProps) {
  const { t } = useTranslation("workout")
  const [open, setOpen] = useState(defaultOpen)

  if (data.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="px-4">
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm text-muted-foreground">
        <span>{t("muscleMap")}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <BodyMap data={data} className="py-2" />
      </CollapsibleContent>
    </Collapsible>
  )
}
