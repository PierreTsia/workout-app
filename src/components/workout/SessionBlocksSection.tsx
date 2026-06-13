import { useTranslation } from "react-i18next"
import { Layers, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ExerciseBlockWithExercises } from "@/types/database"

interface SessionBlocksSectionProps {
  blocks: ExerciseBlockWithExercises[]
  onRun: (blockId: string) => void
  disabled?: boolean
}

/**
 * In-session launcher for the day's Exercise Blocks (#351). Solo navigation is
 * untouched — tapping a circuit opens the full-screen {@link BlockRunner}.
 */
export function SessionBlocksSection({
  blocks,
  onRun,
  disabled,
}: SessionBlocksSectionProps) {
  const { t } = useTranslation("workout")
  if (blocks.length === 0) return null

  return (
    <section className="px-4 pb-2">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        {t("blockRunner.circuitsTitle")}
      </p>
      <ul className="flex flex-col gap-2">
        {blocks.map((block) => (
          <li
            key={block.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/25 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {block.label || t("blockRunner.defaultLabel")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("blockRunner.summary", {
                  exercises: block.exercises.length,
                  rounds: block.rounds,
                })}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={disabled}
              onClick={() => onRun(block.id)}
            >
              <Play className="h-4 w-4" />
              {t("blockRunner.start")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
