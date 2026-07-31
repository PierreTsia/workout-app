import { useAtomValue } from "jotai"
import { forwardRef, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Check, Layers } from "lucide-react"
import {
  prFlagsAtom,
  completedExerciseIdsAtom,
  completedBlockIdsAtom,
} from "@/store/atoms"
import type {
  Exercise,
  ExerciseBlockWithExercises,
  WorkoutExerciseWithLabel,
} from "@/types/database"
import type { SessionItem } from "@/lib/sessionItems"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import { ExerciseThumbnail } from "@/components/exercise/ExerciseThumbnail"
import { cn } from "@/lib/utils"

interface ExerciseStripProps {
  items: SessionItem[]
  /** Batched library rows for strip thumbnails (avoids N `/exercises` calls). */
  libraryById: ReadonlyMap<string, Exercise>
  activeIndex: number
  onSelectIndex: (idx: number) => void
}

export function ExerciseStrip({
  items,
  libraryById,
  activeIndex,
  onSelectIndex,
}: ExerciseStripProps) {
  const prFlags = useAtomValue(prFlagsAtom)
  const completedIds = useAtomValue(completedExerciseIdsAtom)
  const completedBlockIds = useAtomValue(completedBlockIdsAtom)
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
      {items.map((item, idx) =>
        item.kind === "solo" ? (
          <StripItem
            key={item.exercise.id}
            exercise={item.exercise}
            libraryExercise={libraryById.get(item.exercise.exercise_id)}
            isActive={idx === activeIndex}
            hasPr={!!prFlags[item.exercise.exercise_id]}
            isCompleted={completedIds.has(item.exercise.id)}
            ref={idx === activeIndex ? activeRef : undefined}
            onSelect={() => onSelectIndex(idx)}
          />
        ) : (
          <BlockStripItem
            key={item.block.id}
            block={item.block}
            isActive={idx === activeIndex}
            isCompleted={completedBlockIds.has(item.block.id)}
            ref={idx === activeIndex ? activeRef : undefined}
            onSelect={() => onSelectIndex(idx)}
          />
        ),
      )}
    </div>
  )
}

interface StripItemProps {
  exercise: WorkoutExerciseWithLabel
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
    const { exerciseName } = useCatalogLabels()

    return (
      <button
        ref={ref}
        onClick={onSelect}
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all duration-300 ease-out",
          isActive
            ? "w-34 scale-110 ring-2 ring-primary shadow-lg z-10"
            : "w-20 opacity-60",
          isCompleted && "border-green-500/50",
        )}
      >
        {isCompleted && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
            <Check className="h-8 w-8 text-green-400 drop-shadow-lg" strokeWidth={3} />
          </div>
        )}
        {hasPr && (
          <span className="absolute right-1 top-1 z-10 text-xs drop-shadow-sm">🏆</span>
        )}
        <ExerciseThumbnail
          imageUrl={libraryExercise?.image_url}
          emoji={exercise.emoji_snapshot}
          className="aspect-4/3 w-full rounded-none"
        />
        <span className="w-full truncate px-1.5 py-1.5 text-center text-[0.65rem] font-medium leading-tight">
          {exerciseName(exercise)}
        </span>
      </button>
    )
  },
)

interface BlockStripItemProps {
  block: ExerciseBlockWithExercises
  isActive: boolean
  isCompleted: boolean
  onSelect: () => void
}

const BlockStripItem = forwardRef<HTMLButtonElement, BlockStripItemProps>(
  function BlockStripItem({ block, isActive, isCompleted, onSelect }, ref) {
    const { t } = useTranslation("workout")
    const label = block.label ?? t("blockRunner.defaultLabel")

    return (
      <button
        ref={ref}
        onClick={onSelect}
        data-testid="strip-block-item"
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all duration-300 ease-out",
          isActive
            ? "w-34 scale-110 ring-2 ring-primary shadow-lg z-10"
            : "w-20 opacity-60",
          isCompleted && "border-green-500/50",
        )}
      >
        {isCompleted && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
            <Check className="h-8 w-8 text-green-400 drop-shadow-lg" strokeWidth={3} />
          </div>
        )}
        <span className="absolute left-1 top-1 z-10 rounded bg-primary/15 px-1 py-0.5 text-[0.6rem] font-bold text-primary">
          ×{block.rounds}
        </span>
        <div className="flex aspect-4/3 w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
          <Layers className="h-6 w-6 text-primary" />
        </div>
        <span className="w-full truncate px-1.5 py-1.5 text-center text-[0.65rem] font-medium leading-tight">
          {label}
        </span>
      </button>
    )
  },
)
