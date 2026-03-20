import { useCallback, useEffect, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { Zap } from "lucide-react"
import { sessionAtom, isQuickWorkoutAtom } from "@/store/atoms"
import type { WorkoutDay } from "@/types/database"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { WorkoutDayCard } from "./WorkoutDayCard"
import { cn } from "@/lib/utils"

interface WorkoutDayCarouselProps {
  days: WorkoutDay[]
  completedDayIds: string[]
  onQuickWorkout?: () => void
}

export function WorkoutDayCarousel({
  days,
  completedDayIds,
  onQuickWorkout,
}: WorkoutDayCarouselProps) {
  const { t } = useTranslation("generator")
  const [session, setSession] = useAtom(sessionAtom)
  const isQuickWorkout = useAtomValue(isQuickWorkoutAtom)
  const [api, setApi] = useState<CarouselApi>()
  const [activeSlide, setActiveSlide] = useState(0)

  const selectedDayId = session.currentDayId
  const completedSet = new Set(completedDayIds)

  // Validate currentDayId on mount / when days change — reset if stale
  useEffect(() => {
    if (days.length === 0) return
    const valid = selectedDayId && days.some((d) => d.id === selectedDayId)
    if (!valid) {
      selectDay(days[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  // When API initializes or selectedDayId changes, scroll carousel to match
  useEffect(() => {
    if (!api || !selectedDayId) return
    const idx = days.findIndex((d) => d.id === selectedDayId)
    if (idx >= 0 && idx !== api.selectedScrollSnap()) {
      api.scrollTo(idx, true)
      setActiveSlide(idx)
    }
  }, [api, selectedDayId, days])

  const onSelect = useCallback(() => {
    if (!api) return
    const idx = api.selectedScrollSnap()
    setActiveSlide(idx)
    const day = days[idx]
    if (day && day.id !== selectedDayId) {
      selectDay(day.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, days, selectedDayId])

  useEffect(() => {
    if (!api) return
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api, onSelect])

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

  return (
    <div className="space-y-3">
      <Carousel
        setApi={setApi}
        opts={{ align: "start", containScroll: false }}
        className="px-4"
      >
        <CarouselContent className="-ml-3">
          {days.map((day, idx) => (
            <CarouselItem key={day.id} className="basis-[92%] pl-3">
              <WorkoutDayCard
                day={day}
                isActive={idx === activeSlide}
                isCycleDone={completedSet.has(day.id)}
                shouldFetch={Math.abs(idx - activeSlide) <= 1}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="flex items-center justify-center gap-3 px-4">
        <div className="flex gap-1.5">
          {days.map((day, idx) => (
            <button
              key={day.id}
              type="button"
              onClick={() => api?.scrollTo(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === activeSlide ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
        {!session.isActive && !isQuickWorkout && onQuickWorkout && (
          <button
            type="button"
            onClick={onQuickWorkout}
            className="flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Zap className="h-3 w-3" />
            {t("quickWorkout")}
          </button>
        )}
      </div>
    </div>
  )
}
