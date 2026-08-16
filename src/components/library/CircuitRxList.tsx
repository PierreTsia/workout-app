import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"

export interface CircuitRxStation {
  exercise_id: string
  amount: number
}

export function CircuitRxList({
  exercises,
  byId,
  onSelectExercise,
}: {
  exercises: readonly CircuitRxStation[]
  byId: ReadonlyMap<string, { name?: string | null; name_en?: string | null }>
  onSelectExercise?: (exerciseId: string) => void
}) {
  const { t } = useTranslation(["library", "exercise"])
  const { catalogName } = useCatalogLabels()

  return (
    <ul className="flex flex-col gap-2">
      {exercises.map((station) => {
        const row = byId.get(station.exercise_id) ?? null
        const name = catalogName(row)
        const canOpen = onSelectExercise != null && name != null && name !== ""
        return (
          <li
            key={station.exercise_id}
            className="flex items-baseline gap-2 text-sm"
          >
            <span className="font-semibold tabular-nums">{station.amount}</span>
            {canOpen ? (
              <Button
                type="button"
                variant="link"
                className="h-auto min-w-0 justify-start whitespace-normal p-0 text-sm font-normal"
                aria-label={t("exercise:instructionsFor", { name })}
                onClick={() => onSelectExercise?.(station.exercise_id)}
              >
                {name}
              </Button>
            ) : (
              <span className={name ? "text-foreground" : "text-muted-foreground"}>
                {name || t("circuitStationUnknown")}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
