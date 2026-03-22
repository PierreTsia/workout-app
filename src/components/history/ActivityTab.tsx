import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { endOfMonth, format, startOfMonth, subDays } from "date-fns"
import { useTranslation } from "react-i18next"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useTrainingActivityByDay } from "@/hooks/useTrainingActivityByDay"
import { useSessionsForDateRange } from "@/hooks/useSessionsForDateRange"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { pickDefaultSelectedDate } from "@/lib/pickDefaultSelectedDate"
import { formatSessionDayKeyInTimeZone } from "@/lib/sessionDayInTimeZone"
import { buildDenseTrainingDays } from "@/lib/trainingActivityBuckets"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import type { HeatmapCell } from "@/components/history/heatmap-calendar"
import { MonthlySummaryStrip } from "@/components/history/MonthlySummaryStrip"
import { TrainingCalendarCard } from "@/components/history/TrainingCalendarCard"
import { TrainingHeatmap } from "@/components/history/TrainingHeatmap"

/** Heatmap window: ~17 week columns; tuned to fit phone width without horizontal scroll. */
const HEATMAP_DAY_RANGE = 100

export function ActivityTab() {
  const { t } = useTranslation("history")
  const wide = useMediaQuery("(min-width: 768px)")
  const [summaryOpen, setSummaryOpen] = useState(wide)
  const [heatmapOpen, setHeatmapOpen] = useState(wide)

  useEffect(() => {
    setSummaryOpen(wide)
    setHeatmapOpen(wide)
  }, [wide])

  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const userPickedDayRef = useRef(false)

  const visibleKey = format(visibleMonth, "yyyy-MM")

  const monthStart = startOfMonth(visibleMonth)
  const monthEnd = endOfMonth(visibleMonth)
  const pMonthFrom = format(monthStart, "yyyy-MM-dd")
  const pMonthTo = format(monthEnd, "yyyy-MM-dd")

  const heatmapEnd = new Date()
  const heatmapStart = subDays(heatmapEnd, HEATMAP_DAY_RANGE - 1)
  const pHeatFrom = format(heatmapStart, "yyyy-MM-dd")
  const pHeatTo = format(heatmapEnd, "yyyy-MM-dd")

  const {
    data: monthRows,
    isLoading: monthLoading,
    isSuccess: monthSuccess,
  } = useTrainingActivityByDay(pMonthFrom, pMonthTo)
  const { data: heatmapRows = [], isLoading: heatmapLoading } = useTrainingActivityByDay(
    pHeatFrom,
    pHeatTo,
  )

  const { data: rangeSessions = [] } = useSessionsForDateRange(monthStart, monthEnd)

  useEffect(() => {
    userPickedDayRef.current = false
    setSelectedDate(undefined)
  }, [visibleKey])

  useEffect(() => {
    if (!monthSuccess) return
    if (userPickedDayRef.current) return
    setSelectedDate(pickDefaultSelectedDate(visibleMonth, monthRows ?? [], new Date()))
  }, [visibleKey, visibleMonth, monthRows, monthSuccess])

  const denseHeatmap = useMemo(
    () => buildDenseTrainingDays(heatmapRows, pHeatFrom, pHeatTo),
    [heatmapRows, pHeatFrom, pHeatTo],
  )

  const denseMonth = useMemo(
    () => buildDenseTrainingDays(monthRows ?? [], pMonthFrom, pMonthTo),
    [monthRows, pMonthFrom, pMonthTo],
  )

  const tz = getResolvedIANATimeZone()
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""

  const daySessions = useMemo(() => {
    if (!selectedDate) return []
    return rangeSessions.filter((s) => {
      if (!s.finished_at) return false
      return formatSessionDayKeyInTimeZone(s.finished_at, tz) === selectedKey
    })
  }, [rangeSessions, selectedDate, selectedKey, tz])

  const hasSessionsInVisibleMonth = (monthRows ?? []).some((r) => r.session_count > 0)

  const handleHeatmapCell = (cell: HeatmapCell) => {
    if (cell.disabled) return
    userPickedDayRef.current = true
    setSelectedDate(cell.date)
    setVisibleMonth(startOfMonth(cell.date))
  }

  return (
    <div className="flex flex-col gap-4">
      <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
        <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/40">
          <span>{t("activityMonthlySummary")}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <MonthlySummaryStrip
            visibleYear={visibleMonth.getFullYear()}
            visibleMonthIndex={visibleMonth.getMonth()}
            denseMonth={denseMonth}
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={heatmapOpen} onOpenChange={setHeatmapOpen}>
        <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/40">
          <span>{t("activityHeatmapSection", { days: HEATMAP_DAY_RANGE })}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {heatmapLoading ? (
            <div className="h-48 animate-pulse rounded-lg border border-border/60 bg-muted/30" />
          ) : (
            <TrainingHeatmap
              denseRange={denseHeatmap}
              endDate={heatmapEnd}
              rangeDays={HEATMAP_DAY_RANGE}
              onCellClick={handleHeatmapCell}
            />
          )}
        </CollapsibleContent>
      </Collapsible>

      <TrainingCalendarCard
        visibleMonth={visibleMonth}
        onVisibleMonthChange={(m) => setVisibleMonth(startOfMonth(m))}
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          userPickedDayRef.current = true
          setSelectedDate(d)
        }}
        monthRows={monthRows ?? []}
        daySessions={daySessions}
        isLoadingMonth={monthLoading}
        hasSessionsInVisibleMonth={hasSessionsInVisibleMonth}
      />
    </div>
  )
}
