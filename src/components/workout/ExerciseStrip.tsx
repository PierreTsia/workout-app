import { useAtom, useAtomValue } from "jotai"
import { useRef, useEffect } from "react"
import { sessionAtom, prFlagsAtom } from "@/store/atoms"
import type { WorkoutExercise } from "@/types/database"
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
      className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none"
    >
      {exercises.map((ex, idx) => {
        const isActive = idx === session.exerciseIndex
        const hasPr = prFlags[ex.exercise_id]

        return (
          <button
            key={ex.id}
            ref={isActive ? activeRef : undefined}
            onClick={() =>
              setSession((prev) => ({ ...prev, exerciseIndex: idx }))
            }
            className={cn(
              "relative flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-all",
              isActive
                ? "ring-2 ring-primary bg-card"
                : "bg-secondary/50 text-muted-foreground",
            )}
          >
            {hasPr && (
              <span className="absolute -right-1 -top-1 text-xs">🏆</span>
            )}
            <span className="text-lg">{ex.emoji_snapshot}</span>
            <span className="max-w-[4.5rem] truncate font-medium">
              {ex.name_snapshot}
            </span>
          </button>
        )
      })}
    </div>
  )
}
