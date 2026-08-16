import { useTranslation } from "react-i18next"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"

export interface CircuitRxStation {
  exercise_id: string
  amount: number
}

export function CircuitRxList({
  exercises,
  byId,
}: {
  exercises: readonly CircuitRxStation[]
  byId: ReadonlyMap<string, { name?: string | null; name_en?: string | null }>
}) {
  const { t } = useTranslation("library")
  const { catalogName } = useCatalogLabels()

  return (
    <ul className="flex flex-col gap-2">
      {exercises.map((station) => {
        const row = byId.get(station.exercise_id) ?? null
        const name = catalogName(row)
        return (
          <li
            key={station.exercise_id}
            className="flex items-baseline gap-2 text-sm"
          >
            <span className="font-semibold tabular-nums">{station.amount}</span>
            <span className={name ? "text-foreground" : "text-muted-foreground"}>
              {name || t("circuitStationUnknown")}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
