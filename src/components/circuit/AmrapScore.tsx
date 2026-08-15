import { useTranslation } from "react-i18next"

interface AmrapScoreProps {
  fullRounds: number
  leftover: number
  leftoverName: string
}

/** Sole renderer of an AMRAP score — hero `27+3` plus named leftover gloss. */
export function AmrapScore({
  fullRounds,
  leftover,
  leftoverName,
}: AmrapScoreProps) {
  const { t } = useTranslation("workout")
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-4xl font-bold tabular-nums">
        {fullRounds}+{leftover}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("blockRunner.amrapScoreGloss", {
          rounds: fullRounds,
          leftover,
          name: leftoverName,
        })}
      </p>
    </div>
  )
}
