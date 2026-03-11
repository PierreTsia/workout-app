import { useAtom } from "jotai"
import { useEffect, useRef } from "react"
import { sessionAtom } from "@/store/atoms"
import type { WorkoutDay } from "@/types/database"
import { cn } from "@/lib/utils"

interface DaySelectorProps {
  days: WorkoutDay[]
}

export function DaySelector({ days }: DaySelectorProps) {
  const [session, setSession] = useAtom(sessionAtom)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session.currentDayId && days.length > 0) {
      selectDay(days[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  function selectDay(dayId: string) {
    setSession((prev) => ({
      ...prev,
      currentDayId: dayId,
      exerciseIndex: 0,
      isActive: true,
      startedAt: prev.startedAt ?? Date.now(),
      totalSetsDone: prev.currentDayId === dayId ? prev.totalSetsDone : 0,
    }))
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none"
    >
      {days.map((day) => (
        <button
          key={day.id}
          onClick={() => selectDay(day.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
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
  )
}
