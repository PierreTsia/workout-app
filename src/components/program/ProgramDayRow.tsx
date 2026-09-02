import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronDown, Dumbbell, Pencil, Repeat } from "lucide-react"
import { DayItemLines, type DayCardItem } from "@/components/library/DayCard"
import { ExerciseDetailSheet } from "@/components/generator/ExerciseDetailSheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useExerciseById } from "@/hooks/useExerciseById"
import type { BuilderLocationState } from "@/lib/builderLocationState"
import type { ProgramDayCard } from "@/hooks/useProgramDayCards"

function soloSetCount(items: readonly DayCardItem[]): number {
  return items
    .filter((item): item is Extract<DayCardItem, { kind: "solo" }> => item.kind === "solo")
    .reduce((sum, item) => sum + item.sets, 0)
}

export function ProgramDayRow({
  day,
  index,
  to,
  linkState,
}: {
  day: ProgramDayCard
  index: number
  to?: string
  linkState?: BuilderLocationState
}) {
  const { t } = useTranslation("program")
  const { t: tLibrary } = useTranslation("library")
  const sets = soloSetCount(day.items)
  const [inspectId, setInspectId] = useState<string | null>(null)
  const { data: inspected } = useExerciseById(inspectId)

  return (
    <Collapsible>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-stretch">
            <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <span className="text-2xl leading-none" aria-hidden>
                {day.emoji}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold leading-tight">
                  {day.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("days.index", { count: index })}
                </span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {tLibrary("exerciseCount", { count: day.exerciseCount })}
                    </span>
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {t("facts.sets", { count: sets })}
                    </span>
                  </span>
                </span>
              </div>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            {to != null && (
              <div className="flex items-center pr-2">
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <Link
                    to={to}
                    state={linkState}
                    aria-label={t("days.edit", { day: day.name })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
          <CollapsibleContent>
            <div className="flex flex-col gap-1.5 border-t px-4 pb-4 pt-3">
              {day.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("days.empty")}</p>
              ) : (
                <DayItemLines
                  items={day.items}
                  onSelectExercise={setInspectId}
                />
              )}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
      <ExerciseDetailSheet
        exercise={inspected ?? null}
        open={inspectId != null && inspected != null}
        onOpenChange={(open) => {
          if (!open) setInspectId(null)
        }}
      />
    </Collapsible>
  )
}
