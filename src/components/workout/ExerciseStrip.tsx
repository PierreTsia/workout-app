import { useAtomValue } from "jotai"
import { forwardRef, useEffect, useRef } from "react"
import { Check } from "lucide-react"
import { prFlagsAtom, completedExerciseIdsAtom } from "@/store/atoms"
import type { Exercise, WorkoutExercise } from "@/types/database"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { cn } from "@/lib/utils"

interface ExerciseStripProps {
  exercises: WorkoutExercise[]
  /** Batched library rows for strip thumbnails (avoids N `/exercises` calls). */
  libraryById: ReadonlyMap<string, Exercise>
  activeIndex: number
  onSelectIndex: (idx: number) => void
}

export function ExerciseStrip({
  exercises,
  libraryById,
  activeIndex,
  onSelectIndex,
}: ExerciseStripProps) {
  const prFlags = useAtomValue(prFlagsAtom)
  const completedIds = useAtomValue(completedExerciseIdsAtom)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [activeIndex])

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-2 overflow-x-auto px-4 py-2 scrollbar-none"
    >
      {exercises.map((ex, idx) => (
        <StripItem
          key={ex.id}
          exercise={ex}
          libraryExercise={libraryById.get(ex.exercise_id)}
          isActive={idx === activeIndex}
          hasPr={!!prFlags[ex.exercise_id]}
          isCompleted={completedIds.has(ex.id)}
          ref={idx === activeIndex ? activeRef : undefined}
          onSelect={() => onSelectIndex(idx)}
        />
      ))}
    </div>
  )
}

interface StripItemProps {
  exercise: WorkoutExercise
  libraryExercise: Exercise | undefined
  isActive: boolean
  hasPr: boolean
  isCompleted: boolean
  onSelect: () => void
}

const StripItem = forwardRef<HTMLButtonElement, StripItemProps>(
  function StripItem(
    { exercise, libraryExercise, isActive, hasPr, isCompleted, onSelect },
    ref,
  ) {
    return (
      <button
        ref={ref}
        onClick={onSelect}
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300 ease-out",
          isActive
            ? "w-[8.5rem] scale-110 ring-2 ring-primary shadow-lg z-10"
            : "w-[5rem] opacity-60",
          isCompleted && "border-green-500/50",
        )}
      >
        {isCompleted && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
            <Check className="h-8 w-8 text-green-400 drop-shadow-lg" strokeWidth={3} />
          </div>
        )}
        {hasPr && (
          <span className="absolute right-1 top-1 z-10 text-xs drop-shadow">🏆</span>
        )}
        <ExerciseThumbnail
          imageUrl={libraryExercise?.image_url}
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
