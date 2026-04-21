import type { ExercisePreviewItem } from "@/lib/sessionSummary"
import { useWeightUnit } from "@/hooks/useWeightUnit"

interface ExerciseListPreviewProps {
  items: ExercisePreviewItem[]
}

export function ExerciseListPreview({ items }: ExerciseListPreviewProps) {
  const { formatWeight } = useWeightUnit()

  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3"
        >
          <span className="text-2xl leading-none">{item.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {item.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.sets} × {item.reps}
              {item.maxWeight > 0 && ` · ${formatWeight(item.maxWeight)}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
