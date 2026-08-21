import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface AmrapScoreProps {
  fullRounds: number
  leftover: number
  leftoverName: string
  /** `hero` = Round Screen done. `compact` = history card/sheet (sits with Circuit, not over it). */
  size?: "hero" | "compact"
  /** Compact defaults to `end` (history). Profile rows use `start`. */
  align?: "start" | "end"
}

/** Sole renderer of an AMRAP score — `27+3` plus named leftover gloss. */
export function AmrapScore({
  fullRounds,
  leftover,
  leftoverName,
  size = "hero",
  align,
}: AmrapScoreProps) {
  const { t } = useTranslation("workout")
  const compact = size === "compact"
  const edge = align ?? (compact ? "end" : "center")
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        edge === "end" && "items-end",
        edge === "start" && "items-start",
        edge === "center" && "items-center gap-1",
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
          compact && "max-w-[11rem] truncate text-[10px]",
          compact && edge === "end" && "text-right",
          compact && edge === "start" && "text-left",
          !compact && "text-sm",
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
