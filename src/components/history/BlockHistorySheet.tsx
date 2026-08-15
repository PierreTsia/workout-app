import { useTranslation } from "react-i18next"
import { Layers, Loader2, Trophy, TrendingDown, TrendingUp } from "lucide-react"
import { AmrapScore } from "@/components/circuit/AmrapScore"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ExerciseHistoryTrendChart } from "@/components/workout/ExerciseHistoryTrendChart"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useBenchmarkCompletionHistory } from "@/hooks/useBenchmarkCompletionHistory"
import { useBlockCompletionHistory } from "@/hooks/useBlockCompletionHistory"
import { BenchmarkStoryHeader } from "@/components/history/BenchmarkStoryHeader"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import { formatSecondsMMSS } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { AmrapRunView } from "@/lib/amrapScore"
import type { BlockRunView } from "@/lib/blockCompletionHistory"

interface BlockHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The circuit's `block_id` (the history group's key). */
  blockId: string
  /** Catalog identity — when set, history is keyed by this id, not `blockId`. */
  catalogId?: string | null
  label: string | null
}

/** Delta chip: an arrow + magnitude, green when faster, red when slower. */
function DeltaChip({ seconds }: { seconds: number }) {
  const { t } = useTranslation("history")
  const faster = seconds < 0
  const Icon = faster ? TrendingDown : TrendingUp
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
        faster ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {faster ? "−" : "+"}
      {Math.abs(seconds)}s
      <span className="font-normal text-muted-foreground"> {t("circuit.vsPrevious")}</span>
    </span>
  )
}

function AmrapDeltaChip({ rounds }: { rounds: number }) {
  const { t } = useTranslation("history")
  const improved = rounds > 0
  const Icon = improved ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
        improved ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {improved ? "+" : "−"}
      {t("circuit.roundsDelta", { count: Math.abs(rounds) })}
      <span className="font-normal text-muted-foreground"> {t("circuit.vsPrevious")}</span>
    </span>
  )
}

function AmrapRunRow({ view }: { view: AmrapRunView }) {
  const { t, i18n } = useTranslation("history")
  const when = formatRelativeTime(view.date, i18n.language)

  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{when}</p>
        {view.shapeChanged && (
          <p className="text-[11px] text-muted-foreground">{t("circuit.shapeChanged")}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {view.score != null ? (
          <div className="flex items-center gap-2">
            {view.isPb && (
              <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                <Trophy className="h-3 w-3" aria-hidden />
                {t("circuit.pb")}
              </span>
            )}
            <AmrapScore
              size="compact"
              fullRounds={view.score.fullRounds}
              leftover={view.score.leftover}
              leftoverName={view.score.leftoverName}
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t("circuit.incompleteRun")}</span>
        )}
        {view.score != null && view.deltaRounds != null && (
          <AmrapDeltaChip rounds={view.deltaRounds} />
        )}
      </div>
    </li>
  )
}

function RunRow({ view }: { view: BlockRunView }) {
  const { t, i18n } = useTranslation("history")
  const { run } = view
  const when = formatRelativeTime(run.date, i18n.language)

  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{when}</p>
        {view.shapeChanged && (
          <p className="text-[11px] text-muted-foreground">{t("circuit.shapeChanged")}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {run.isComplete ? (
          <div className="flex items-center gap-2">
            {view.isPb && (
              <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                <Trophy className="h-3 w-3" aria-hidden />
                {t("circuit.pb")}
              </span>
            )}
            <span className="font-mono text-sm font-semibold tabular-nums">
              {formatSecondsMMSS(run.completionSeconds)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t("circuit.incompleteRun")}</span>
        )}
        {run.isComplete && view.deltaSeconds != null && (
          <DeltaChip seconds={view.deltaSeconds} />
        )}
      </div>
    </li>
  )
}

/**
 * Per-circuit completion-time history (#396): a trend of times for the current
 * prescription, then a run-by-run list with deltas and a PB badge. Read-only,
 * derived from `set_logs` — no progression, no writes (ADR 0008).
 */
export function BlockHistorySheet({
  open,
  onOpenChange,
  blockId,
  catalogId,
  label,
}: BlockHistorySheetProps) {
  const { t, i18n } = useTranslation("history")
  const isOnline = useOnlineStatus()
  const { unit } = useWeightUnit()
  const isCatalog = Boolean(catalogId)
  const blockHistory = useBlockCompletionHistory(open && !isCatalog, blockId)
  const catalogHistory = useBenchmarkCompletionHistory(
    open && isCatalog,
    catalogId ?? undefined,
  )

  const isLoading = isCatalog ? catalogHistory.isLoading : blockHistory.isLoading
  const isError = isCatalog ? catalogHistory.isError : blockHistory.isError
  const refetch = isCatalog ? catalogHistory.refetch : blockHistory.refetch
  const copy = isCatalog ? (catalogHistory.data?.copy ?? null) : null

  const isAmrap = isCatalog || blockHistory.data?.mode === "amrap"
  const views = isCatalog ? [] : (blockHistory.data?.views ?? [])
  const amrapViews = isCatalog
    ? (catalogHistory.data?.amrapViews ?? [])
    : (blockHistory.data?.amrapViews ?? [])
  const trend = blockHistory.data?.trend ?? { seconds: [], dates: [] }
  const showTrend = !isAmrap && trend.seconds.length >= 2
  const trendXLabels = trend.dates.map((d) => formatRelativeTime(d, i18n.language))
  const hasRuns = isAmrap ? amrapViews.length > 0 : views.length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92vh] flex-col rounded-t-2xl border-x-0 border-t border-b-0 p-0"
      >
        <SheetHeader className="gap-0 border-b border-border px-4 pb-3 pt-2 text-left">
          <div className="flex items-center gap-2 pr-10">
            <Layers className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <SheetTitle className="text-base font-semibold">
              {t("circuit.sheetTitle")}
            </SheetTitle>
          </div>
          <p className="pt-1 font-semibold leading-tight">
            {label ?? t("circuit.fallbackLabel")}
          </p>
          {copy ? (
            <div className="pt-2">
              <BenchmarkStoryHeader copy={copy} />
            </div>
          ) : null}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 pt-3">
          {!isOnline ? (
            <p className="text-sm text-muted-foreground">{t("circuit.offline")}</p>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <span className="text-sm">{t("circuit.loading")}</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col gap-3 py-4">
              <p className="text-sm text-destructive">{t("circuit.loadError")}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {t("circuit.retry")}
              </Button>
            </div>
          ) : !hasRuns ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {isCatalog ? t("circuit.noPrYet") : t("circuit.noCompletedRuns")}
            </p>
          ) : (
            <>
              {isAmrap ? null : showTrend ? (
                <div className="mb-4 w-full">
                  <ExerciseHistoryTrendChart
                    variant="completionTime"
                    valuesDisplay={trend.seconds}
                    xLabels={trendXLabels}
                    unit={unit}
                  />
                </div>
              ) : (
                <p className="mb-4 text-center text-xs text-muted-foreground">
                  {t("circuit.trendHint")}
                </p>
              )}

              <ul className="flex flex-col">
                {isAmrap
                  ? amrapViews.map((view) => (
                      <AmrapRunRow key={view.sessionId} view={view} />
                    ))
                  : views.map((view) => (
                      <RunRow key={view.run.sessionId} view={view} />
                    ))}
              </ul>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
