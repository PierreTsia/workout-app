import { useTranslation } from "react-i18next"
import { toMuscleSetRanks, type MuscleRadarValues } from "@/components/profile/charts/profileChartData"

export function MuscleSetRanks({ values }: { values: MuscleRadarValues }) {
  const { t } = useTranslation("profile")
  const ranks = toMuscleSetRanks(values)

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[10px] leading-tight text-muted-foreground">
        {t("balance.rankLegend")}
      </p>
      <ul
        className="flex flex-col gap-1"
        aria-label={t("balance.rankLegend")}
      >
        {ranks.map((row) => (
          <li
            key={row.muscle}
            className="grid grid-cols-[minmax(0,1fr)_1.25rem] items-center gap-1.5 text-[10px] leading-tight"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{row.muscle}</span>
              <span className="h-1 min-w-4 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full origin-left rounded-full bg-[hsl(174_100%_39%)]"
                  style={{ transform: `scaleX(${row.fill})` }}
                />
              </span>
            </span>
            <span className="text-right tabular-nums">{row.sets}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
