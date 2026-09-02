import { Layers } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCatalogLabels } from "@/hooks/useCatalogLabels"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDayOutlineCaption } from "@/lib/programScore/dayOutline"
import type { ProgramDayOutline } from "@/lib/programScore/types"
import { useProgramCardLayer } from "@/components/library/programCardLayer"

export function DayOutlinePopover({ day }: { day: ProgramDayOutline }) {
  const { t } = useTranslation("program")
  const { t: tLibrary } = useTranslation("library")
  const { exerciseName } = useCatalogLabels()
  const layer = useProgramCardLayer()
  const caption = formatDayOutlineCaption(day)
  const ordered = [...day.items].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <Popover onOpenChange={layer?.onLayerOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="pointer-events-auto relative z-10 rounded-sm text-left underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 hover:decoration-foreground"
          aria-label={t("days.preview", { day: day.label.trim() || caption })}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {caption}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={16}
        className="w-auto max-w-72 p-3"
      >
        {ordered.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("days.empty")}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ordered.map((item) =>
              item.kind === "circuit" ? (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <Layers className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">
                      {item.label?.trim() || tLibrary("circuit.fallbackLabel")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tLibrary("circuit.summary", {
                      count: item.exerciseCount,
                      rounds: item.rounds,
                    })}
                  </span>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">
                    {[item.emoji, exerciseName({
                      name_snapshot: item.name_snapshot,
                      exercise: item.exercise,
                    })]
                      .map((part) => part.trim())
                      .filter((part) => part.length > 0)
                      .join(" ")}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tLibrary("setsReps", { sets: item.sets, reps: item.reps })}
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
