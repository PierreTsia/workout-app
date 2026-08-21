import { useTranslation } from "react-i18next"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"
import { AmrapScore } from "@/components/circuit/AmrapScore"
import { CircuitScoreSparkline } from "@/components/profile/charts/CircuitScoreSparkline"
import { Badge } from "@/components/ui/badge"
import { formatSecondsMMSS } from "@/lib/formatters"
import {
  circuitBestAmrap,
  circuitBestTours,
  circuitSparkValues,
  type CircuitRowFixture,
} from "@/lib/profile/window"

function CircuitModeLabel({ row }: { row: CircuitRowFixture }) {
  const { t } = useTranslation("builder")
  if (row.mode === "amrap") {
    return <AmrapLabel minutes={row.minutes} variant="inline" />
  }
  return (
    <span className="text-xs text-muted-foreground">
      {t("blockRounds", { count: row.rounds })}
    </span>
  )
}

const STACK_COL = "flex min-h-[2.375rem] w-full flex-col gap-0.5"

function CircuitRunCount({ n }: { n: number }) {
  const { t } = useTranslation("profile")
  return (
    <div className={STACK_COL}>
      <p className="text-sm font-semibold tabular-nums">{n}</p>
      <p className="text-[10px] text-muted-foreground">{t("circuits.runs")}</p>
    </div>
  )
}

function CircuitBestScore({ row }: { row: CircuitRowFixture }) {
  if (row.mode === "amrap") {
    const best = circuitBestAmrap(row.runs)
    return best == null ? null : (
      <div className={STACK_COL}>
        <AmrapScore
          fullRounds={best.fullRounds}
          leftover={best.leftover}
          leftoverName={best.leftoverName}
          size="compact"
          align="start"
        />
      </div>
    )
  }
  const best = circuitBestTours(row.runs)
  return best == null ? null : (
    <div className={STACK_COL}>
      <p className="text-sm font-semibold tabular-nums">
        {formatSecondsMMSS(best.seconds)}
      </p>
    </div>
  )
}

export function CircuitLedgerRow({ row }: { row: CircuitRowFixture }) {
  const { t } = useTranslation("profile")

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_3.25rem_8rem_6rem] items-start gap-3">
      <div className="min-w-0">
        <div className="flex items-start gap-1.5">
          <span className="font-medium">{row.name}</span>
          {row.pb ? (
            <Badge className="mt-0.5 h-4 shrink-0 px-1.5 py-0 text-[10px] leading-none">
              {t("circuits.pb")}
            </Badge>
          ) : null}
        </div>
        <CircuitModeLabel row={row} />
      </div>
      <CircuitRunCount n={row.runCount} />
      <CircuitBestScore row={row} />
      <CircuitScoreSparkline name={row.name} values={circuitSparkValues(row)} />
    </li>
  )
}
