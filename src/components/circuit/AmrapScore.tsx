import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface AmrapScoreProps {
  fullRounds: number
  leftover: number
  leftoverName: string
  /** `hero` = Round Screen done. `compact` = history card/sheet (sits with Circuit, not over it). */
  size?: "hero" | "compact"
}

/** Sole renderer of an AMRAP score — `27+3` plus named leftover gloss. */
export function AmrapScore({
  fullRounds,
  leftover,
  leftoverName,
  size = "hero",
}: AmrapScoreProps) {
  const { t } = useTranslation("workout")
  const compact = size === "compact"
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        compact ? "items-end" : "items-center gap-1",
      )}
    >
      <p
        className={cn(
          "font-semibold tabular-nums",
          compact ? "text-sm" : "text-4xl font-bold",
        )}
      >
        {fullRounds}+{leftover}
      </p>
      <p
        className={cn(
          "text-muted-foreground",
          compact ? "max-w-[11rem] truncate text-right text-[10px]" : "text-sm",
        )}
      >
        {t("blockRunner.amrapScoreGloss", {
          rounds: fullRounds,
          leftover,
          name: leftoverName,
        })}
      </p>
    </div>
  )
}
