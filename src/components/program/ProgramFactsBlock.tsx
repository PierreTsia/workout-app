import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import type { EquipmentMixBucket, ProgramFacts } from "@/lib/programScore/types"

const MIX_BUCKETS: readonly EquipmentMixBucket[] = [
  "free",
  "machine",
  "bodyweight",
  "other",
]

export function ProgramFactsBlock({ facts }: { facts: ProgramFacts }) {
  const { t } = useTranslation("program")
  const mixRows = MIX_BUCKETS.filter((bucket) => facts.mix[bucket] > 0)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-sm font-medium">
          {t("facts.line", {
            days: facts.dayCount,
            sets: facts.setCount,
            circuits: facts.circuitCount,
          })}
        </p>
        {mixRows.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {mixRows.map((bucket) => (
              <div
                key={bucket}
                className="flex items-baseline justify-between gap-2 rounded-md bg-muted/50 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">
                  {t(`facts.mix.${bucket}`)}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {facts.mix[bucket]}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
