import { useTranslation } from "react-i18next"
import { AmrapLabel } from "@/components/circuit/AmrapLabel"
import { AmrapScore } from "@/components/circuit/AmrapScore"
import { CircuitScoreSparkline } from "@/components/profile/charts/CircuitScoreSparkline"
import { Badge } from "@/components/ui/badge"
import { formatSecondsMMSS } from "@/lib/formatters"
import type { CircuitLedgerRowVm } from "@/lib/profile/circuitLedger"

function CircuitModeLabel({ row }: { row: CircuitLedgerRowVm }) {
  const { t } = useTranslation("builder")
  if (row.mode === "amrap") {
    return <AmrapLabel minutes={row.minutes} variant="badge" />
  }
  return (
    <span className="block min-w-0 truncate text-xs text-muted-foreground">
      {t("blockRounds", { count: row.rounds })}
    </span>
  )
}

const STACK_COL = "flex min-h-[2.375rem] w-full min-w-0 flex-col gap-0.5 overflow-hidden"

function CircuitRunCount({ n }: { n: number }) {
  const { t } = useTranslation("profile")
  return (
    <div className={STACK_COL}>
      <p className="text-sm font-semibold tabular-nums">{n}</p>
      <p className="truncate text-[10px] text-muted-foreground">
        {t("circuits.runs")}
      </p>
    </div>
  )
}

function CircuitBestScore({ row }: { row: CircuitLedgerRowVm }) {
  if (row.mode === "amrap") {
    return (
      <div className={STACK_COL}>
        <AmrapScore
          fullRounds={row.best.fullRounds}
          leftover={row.best.leftover}
          leftoverName={row.best.leftoverName}
          size="compact"
          align="start"
        />
      </div>
    )
  }
  return (
    <div className={STACK_COL}>
      <p className="text-sm font-semibold tabular-nums">
        {formatSecondsMMSS(row.best.seconds)}
      </p>
    </div>
  )
}

export const CIRCUIT_LEDGER_ROW_CLASS =
  "grid grid-cols-[minmax(0,1.2fr)_2.5rem_minmax(0,1fr)_3.5rem] items-start gap-2 [&>*]:min-w-0"

export function CircuitLedgerRow({ row }: { row: CircuitLedgerRowVm }) {
  const { t } = useTranslation("profile")

  return (
    <li className={CIRCUIT_LEDGER_ROW_CLASS}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate font-medium" title={row.name}>
            {row.name}
          </span>
          {row.pb ? (
            <Badge className="h-4 shrink-0 px-1.5 py-0 text-[10px] leading-none">
              {t("circuits.pb")}
            </Badge>
          ) : null}
        </div>
        <CircuitModeLabel row={row} />
      </div>
      <CircuitRunCount n={row.runCount} />
      <CircuitBestScore row={row} />
      <CircuitScoreSparkline
        name={row.name}
        values={row.sparkValues}
        mode={row.mode}
        days={row.sparkDays}
      />
    </li>
  )
}
