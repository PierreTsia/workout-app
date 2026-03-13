import { useAtom, useAtomValue } from "jotai"
import { useRef, useEffect } from "react"
import { sessionAtom, prFlagsAtom } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
import { useExerciseFromLibrary } from "@/hooks/useExerciseFromLibrary"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { cn } from "@/lib/utils"

interface ExerciseStripProps {
  exercises: WorkoutExercise[]
}

export function ExerciseStrip({ exercises }: ExerciseStripProps) {
  const [session, setSession] = useAtom(sessionAtom)
  const prFlags = useAtomValue(prFlagsAtom)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [session.exerciseIndex])

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-2 overflow-x-auto px-4 py-2 scrollbar-none"
    >
      {exercises.map((ex, idx) => (
        <StripItem
          key={ex.id}
          exercise={ex}
          isActive={idx === session.exerciseIndex}
          hasPr={!!prFlags[ex.exercise_id]}
          ref={idx === session.exerciseIndex ? activeRef : undefined}
          onSelect={() =>
            setSession((prev) => ({ ...prev, exerciseIndex: idx }))
          }
        />
      ))}
    </div>
  )
}

import { forwardRef } from "react"

interface StripItemProps {
  exercise: WorkoutExercise
  isActive: boolean
  hasPr: boolean
  onSelect: () => void
}

const StripItem = forwardRef<HTMLButtonElement, StripItemProps>(
  function StripItem({ exercise, isActive, hasPr, onSelect }, ref) {
    const { data: libExercise } = useExerciseFromLibrary(exercise.exercise_id)

    return (
      <button
        ref={ref}
        onClick={onSelect}
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300 ease-out",
          isActive
            ? "w-[8.5rem] scale-110 ring-2 ring-primary shadow-lg z-10"
            : "w-[5rem] opacity-60",
        )}
      >
        {hasPr && (
          <span className="absolute right-1 top-1 z-10 text-xs drop-shadow">🏆</span>
        )}
        <ExerciseThumbnail
          imageUrl={libExercise?.image_url}
          emoji={exercise.emoji_snapshot}
          className="aspect-[4/3] w-full rounded-none"
        />
        <span className="w-full truncate px-1.5 py-1.5 text-center text-[0.65rem] font-medium leading-tight">
          {exercise.name_snapshot}
        </span>
      </button>
    )
  },
)
