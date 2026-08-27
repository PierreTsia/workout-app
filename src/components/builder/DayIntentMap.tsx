import { Badge } from "@/components/ui/badge"
import {
  BodyMap,
  BODY_MAP_INTENSITY_COLORS,
} from "@/components/body-map/BodyMap"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { dayIntentToHeatmap } from "@/lib/programScore/dayIntentToHeatmap"
import type { ProgramIntentDay } from "@/lib/programScore/types"

function formatCredit(credit: number): string {
  return Number.isInteger(credit) ? String(credit) : credit.toFixed(1)
}

export function DayIntentMap({ day }: { day: ProgramIntentDay }) {
  const { muscleLabel } = useCatalogLabels()
  const { data, chips } = dayIntentToHeatmap(day)

  if (data.length === 0 && chips.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <BodyMap
        data={data}
        size="md"
        highlightedColors={BODY_MAP_INTENSITY_COLORS}
      />
      <div className="flex gap-2 overflow-x-auto">
        {chips.map((chip) => (
          <Badge
            key={chip.muscle}
            variant="outline"
            className="shrink-0 gap-1.5 font-normal"
          >
            <span>{muscleLabel(chip.muscle)}</span>
            <span className="font-mono text-primary">
              {formatCredit(chip.credit)}
            </span>
          </Badge>
        ))}
      </div>
    </div>
  )
}
