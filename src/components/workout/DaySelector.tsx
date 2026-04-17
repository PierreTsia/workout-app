import { useAtom, useAtomValue } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Zap } from "lucide-react"
import { sessionAtom, isQuickWorkoutAtom } from "@/store/atoms"
import type { WorkoutDay } from "@/types/database"
import { cn } from "@/lib/utils"

interface DaySelectorProps {
  days: WorkoutDay[]
  onQuickWorkout?: () => void
}

export function DaySelector({ days, onQuickWorkout }: DaySelectorProps) {
  const { t } = useTranslation("generator")
  const [session, setSession] = useAtom(sessionAtom)
  const isQuickWorkout = useAtomValue(isQuickWorkoutAtom)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const scrollToDay = useCallback((dayId: string) => {
    const el = itemRefs.current.get(dayId)
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [])

  useEffect(() => {
    if (!session.currentDayId && days.length > 0) {
      selectDay(days[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  useEffect(() => {
    if (session.currentDayId) {
      scrollToDay(session.currentDayId)
    }
  }, [session.currentDayId, scrollToDay])

  function selectDay(dayId: string) {
    setSession((prev) => ({
      ...prev,
      currentDayId: dayId,
      exerciseIndex: prev.isActive ? prev.exerciseIndex : 0,
      totalSetsDone: prev.isActive
        ? prev.totalSetsDone
        : prev.currentDayId === dayId
          ? prev.totalSetsDone
          : 0,
    }))
  }

  const quickDayId = isQuickWorkout ? session.activeDayId : null
  const isViewingQuickDay = isQuickWorkout && session.currentDayId === quickDayId

  function selectQuickDay() {
    if (!quickDayId) return
    setSession((prev) => ({
      ...prev,
      currentDayId: quickDayId,
      exerciseIndex: prev.exerciseIndex,
    }))
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 py-2 scrollbar-none"
      >
        {isQuickWorkout && (
          <button
            type="button"
            onClick={selectQuickDay}
            className={cn(
              "flex shrink-0 snap-start items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              isViewingQuickDay
                ? "bg-primary text-primary-foreground"
                : "bg-primary/20 text-primary",
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            {t("quickWorkout")}
          </button>
        )}
        {days.map((day) => (
          <button
            key={day.id}
            ref={(el) => {
              if (el) itemRefs.current.set(day.id, el)
              else itemRefs.current.delete(day.id)
            }}
            onClick={() => selectDay(day.id)}
            className={cn(
              "flex shrink-0 snap-start items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              !isViewingQuickDay && session.currentDayId === day.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            <span>{day.emoji}</span>
            <span>{day.label}</span>
          </button>
        ))}
        {!session.isActive && onQuickWorkout && (
          <button
            type="button"
            onClick={onQuickWorkout}
            className="flex shrink-0 snap-start items-center gap-1.5 rounded-full border border-dashed border-primary/50 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Zap className="h-3.5 w-3.5" />
            {t("quickWorkout")}
          </button>
        )}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background to-transparent" />
    </div>
  )
}
