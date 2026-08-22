import { useTranslation } from "react-i18next"
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
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {t("facts.line", {
          days: facts.dayCount,
          sets: facts.setCount,
          circuits: facts.circuitCount,
        })}
      </p>
      {mixRows.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {mixRows.map((bucket) => (
            <li key={bucket}>
              {t(`facts.mix.${bucket}`)} · {facts.mix[bucket]}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
