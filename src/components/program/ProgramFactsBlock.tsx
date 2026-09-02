import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { EquipmentMixBucket, ProgramFacts } from "@/lib/programScore/types"

const MIX_BUCKETS: readonly EquipmentMixBucket[] = [
  "free",
  "machine",
  "bodyweight",
  "other",
]

const MIX_BAR_CLASS: Record<EquipmentMixBucket, string> = {
  free: "bg-primary",
  machine: "bg-orange-500",
  bodyweight: "bg-muted-foreground/70",
  other: "bg-muted-foreground/35",
}

const STATS = [
  { key: "days", read: (facts: ProgramFacts) => facts.dayCount },
  { key: "sets", read: (facts: ProgramFacts) => facts.setCount },
  { key: "circuits", read: (facts: ProgramFacts) => facts.circuitCount },
] as const

export function ProgramFactsBlock({ facts }: { facts: ProgramFacts }) {
  const { t } = useTranslation("program")
  const mixRows = MIX_BUCKETS.filter((bucket) => facts.mix[bucket] > 0)
  const mixSummary = mixRows
    .map((bucket) => `${t(`facts.mix.${bucket}`)} ${facts.mix[bucket]}`)
    .join(" · ")

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <ul className="grid grid-cols-3">
          {STATS.map((stat, index) => {
            const value = stat.read(facts)
            return (
              <li
                key={stat.key}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-0.5 px-2 text-center",
                  index > 0 && "border-l border-border",
                )}
              >
                <span
                  className={cn(
                    "text-2xl font-semibold tabular-nums tracking-tight",
                    value === 0 && "text-muted-foreground",
                  )}
                >
                  {value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`facts.stat.${stat.key}`)}
                </span>
              </li>
            )
          })}
        </ul>

        {mixRows.length > 0 && (
          <div className="flex flex-col gap-3">
            <Separator />
            <div
              className="flex h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={mixSummary}
            >
              {mixRows.map((bucket) => (
                <div
                  key={bucket}
                  className={cn("min-w-1", MIX_BAR_CLASS[bucket])}
                  style={{ flexGrow: facts.mix[bucket], flexBasis: 0 }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1.5">
              {mixRows.map((bucket) => (
                <li key={bucket} className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "mb-px size-2 shrink-0 self-center rounded-full",
                      MIX_BAR_CLASS[bucket],
                    )}
                    aria-hidden
                  />
                  <span className="text-xs text-muted-foreground">
                    {t(`facts.mix.${bucket}`)}
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {facts.mix[bucket]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
