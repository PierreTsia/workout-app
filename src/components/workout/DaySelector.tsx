import { useAtom } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { sessionAtom } from "@/store/atoms"
import type { WorkoutDay } from "@/types/database"
import { cn } from "@/lib/utils"

interface DaySelectorProps {
  days: WorkoutDay[]
}

export function DaySelector({ days }: DaySelectorProps) {
  const [session, setSession] = useAtom(sessionAtom)
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
      exerciseIndex: 0,
      totalSetsDone: prev.currentDayId === dayId ? prev.totalSetsDone : 0,
    }))
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 py-2 scrollbar-none"
      >
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
              session.currentDayId === day.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            <span>{day.emoji}</span>
            <span>{day.label}</span>
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
    </div>
  )
}
