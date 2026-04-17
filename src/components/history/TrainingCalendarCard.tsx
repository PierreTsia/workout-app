import { useMemo } from "react"
import { enUS, fr } from "date-fns/locale"
import { useTranslation } from "react-i18next"
import { SessionRow } from "@/components/history/SessionRow"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { formatDate } from "@/lib/formatters"
import { weekStartsOnForLanguage } from "@/lib/weekStartsOnForLanguage"
import type { Session } from "@/types/database"
import type { TrainingDayBucketRow } from "@/types/history"

export function TrainingCalendarCard({
  visibleMonth,
  onVisibleMonthChange,
  selectedDate,
  onSelectDate,
  monthRows,
  daySessions,
  isLoadingMonth,
  hasSessionsInVisibleMonth,
}: {
  visibleMonth: Date
  onVisibleMonthChange: (month: Date) => void
  selectedDate: Date | undefined
  onSelectDate: (date: Date | undefined) => void
  monthRows: TrainingDayBucketRow[]
  daySessions: Session[]
  isLoadingMonth: boolean
  hasSessionsInVisibleMonth: boolean
}) {
  const { t, i18n } = useTranslation("history")
  const locale = i18n.language.startsWith("fr") ? fr : enUS
  const weekStartsOn = weekStartsOnForLanguage(i18n.language)

  const trainingDates = useMemo(() => {
    return monthRows
      .filter((r) => r.session_count > 0)
      .map((r) => {
        const [y, m, d] = r.day.split("-").map(Number)
        return new Date(y, m - 1, d)
      })
  }, [monthRows])

  const footerTitle = selectedDate
    ? formatDate(selectedDate, i18n.language, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : ""

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("activityCalendarTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center pb-2 pt-0">
        {isLoadingMonth ? (
          <div className="h-[320px] w-full max-w-sm animate-pulse rounded-md bg-muted/30" />
        ) : (
          <Calendar
            locale={locale}
            weekStartsOn={weekStartsOn}
            mode="single"
            month={visibleMonth}
            onMonthChange={onVisibleMonthChange}
            selected={selectedDate}
            onSelect={onSelectDate}
            modifiers={{ training: trainingDates }}
            modifiersClassNames={{
              training:
                "relative font-medium after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
            }}
            showOutsideDays
            className="rounded-md border border-border/50"
          />
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t border-border/60 pt-4">
        {!isLoadingMonth && !hasSessionsInVisibleMonth ? (
          <div className="flex flex-col gap-1 py-4 text-center">
            <p className="text-sm font-medium text-foreground">{t("emptyMonthTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("emptyMonthSubtitle")}</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground">{footerTitle}</p>
            {!isLoadingMonth && hasSessionsInVisibleMonth && daySessions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("emptyDayTitle")}</p>
            ) : (
              <div className="flex max-h-[min(50vh,24rem)] flex-col divide-y divide-border overflow-y-auto rounded-md border border-border/50">
                {daySessions.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </div>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  )
}
