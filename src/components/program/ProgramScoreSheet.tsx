import { useTranslation } from "react-i18next"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import type { ProgramIntentScore } from "@/lib/programScore/hypertrophyExample"
import type { ScoreBand } from "@/lib/programScore/types"

const TRACKS = ["hypertrophy", "strength", "endurance"] as const

function bandLabel(
  t: (key: string) => string,
  band: ScoreBand,
): string | null {
  if (band === "empty") return null
  return t(`band.${band}`)
}

export function ProgramScoreSheet({ score }: { score: ProgramIntentScore }) {
  const { t } = useTranslation("program")
  const { muscleLabel } = useCatalogLabels()
  const example = score.hypertrophyExample
  const hypertrophyBand = bandLabel(t, score.hypertrophy.band)

  return (
    <div className="flex flex-col gap-4">
      {TRACKS.map((track) => {
        const band = bandLabel(t, score[track].band)
        return (
          <Collapsible key={track}>
            <CollapsibleTrigger className="flex w-full flex-col gap-1 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50">
              <p className="text-sm font-medium">
                {t(`track.${track}`)}
                {band != null ? ` · ${band}` : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(`rubric.${track}`)}
              </p>
            </CollapsibleTrigger>
            {track === "hypertrophy" && example != null && hypertrophyBand != null ? (
              <CollapsibleContent className="px-1 pt-1">
                <p className="text-sm text-muted-foreground">
                  {t("example.hypertrophy", {
                    muscle: muscleLabel(example.muscle),
                    sets: example.sets,
                    days: example.days,
                    band: t(`band.${example.band}`),
                  })}
                </p>
              </CollapsibleContent>
            ) : null}
          </Collapsible>
        )
      })}

      <Collapsible>
        <CollapsibleTrigger className="flex w-full flex-col gap-1 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50">
          <p className="text-sm font-medium">
            {t("track.balance")}
            {score.balance.kind === "score" ? ` ${score.balance.value}` : null}
          </p>
          <p className="text-sm text-muted-foreground">{t("rubric.balance")}</p>
        </CollapsibleTrigger>
      </Collapsible>
    </div>
  )
}
