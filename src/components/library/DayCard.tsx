import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronRight, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import type { BuilderLocationState } from "@/lib/builderLocationState"
import { compactNumberSequence } from "@/lib/blockPrescription"
import { cn } from "@/lib/utils"

/** Solo line in a library day summary. */
export interface DayExercise {
  id: string
  emoji: string
  name: string
  sets: number
  reps: string
  restSeconds: number
  sortOrder: number
  /** Catalog id — set when the line can open instructions. */
  exerciseId?: string | null
}

/** One station inside a Circuit summary. */
export interface DayCircuitStation {
  id: string
  name: string
  emoji: string
  amounts: number[]
  isDuration: boolean
  exerciseId?: string | null
}

/** Circuit line in a library day summary (#454). */
export interface DayCircuitSummary {
  id: string
  label: string | null
  rounds: number
  exerciseCount: number
  sortOrder: number
  stations?: readonly DayCircuitStation[]
}

export type DayCardItem =
  | ({ kind: "solo" } & DayExercise)
  | ({ kind: "circuit" } & DayCircuitSummary)

export function DayItemLines({
  items,
  onSelectExercise,
}: {
  items: readonly DayCardItem[]
  onSelectExercise?: (exerciseId: string) => void
}) {
  const { t } = useTranslation("library")
  const { t: tExercise } = useTranslation("exercise")
  const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-0.5">
      {ordered.map((item) =>
        item.kind === "circuit" ? (
          <CircuitDayItem
            key={item.id}
            item={item}
            onSelectExercise={onSelectExercise}
          />
        ) : (
          <PeekRow
            key={item.id}
            tile={item.emoji}
            title={item.name}
            subtitle={`${t("setsReps", { sets: item.sets, reps: item.reps })} · ${t("restSeconds", { seconds: item.restSeconds })}`}
            instructionsLabel={tExercise("instructionsFor", { name: item.name })}
            exerciseId={item.exerciseId}
            onSelectExercise={onSelectExercise}
          />
        ),
      )}
    </div>
  )
}

function CircuitDayItem({
  item,
  onSelectExercise,
}: {
  item: Extract<DayCardItem, { kind: "circuit" }>
  onSelectExercise?: (exerciseId: string) => void
}) {
  const { t } = useTranslation("library")
  const { t: tExercise } = useTranslation("exercise")
  const { t: tWorkout } = useTranslation("workout")
  const stations = item.stations ?? []

  return (
    <div data-testid={`day-card-circuit-${item.id}`} className="flex flex-col">
      <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Layers className="h-3.5 w-3.5 text-primary" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate font-medium">
            {item.label?.trim() || t("circuit.fallbackLabel")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {t("circuit.summary", {
              count: item.exerciseCount,
              rounds: item.rounds,
            })}
          </span>
        </span>
      </div>
      {stations.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-4">
          {stations.map((station) => (
            <PeekRow
              key={station.id}
              tile={station.emoji}
              title={station.name}
              subtitle={stationRxLabel(station, tWorkout)}
              instructionsLabel={tExercise("instructionsFor", {
                name: station.name,
              })}
              exerciseId={station.exerciseId}
              onSelectExercise={onSelectExercise}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function stationRxLabel(
  station: DayCircuitStation,
  t: (key: string, options?: { count: number }) => string,
): string | undefined {
  if (station.amounts.length === 0) return undefined
  const compact = compactNumberSequence([...station.amounts])
  const first = station.amounts[0]
  const uniform = station.amounts.every((value) => value === first)
  if (station.isDuration) {
    return uniform
      ? t("blockRunner.seconds", { count: first })
      : `${compact}${t("blockRunner.secondsUnit")}`
  }
  return uniform
    ? t("blockRunner.reps", { count: first })
    : `${compact} ${t("blockRunner.repsUnit")}`
}

function PeekRow({
  tile,
  title,
  subtitle,
  instructionsLabel,
  exerciseId,
  onSelectExercise,
}: {
  tile: string
  title: string
  subtitle?: string
  instructionsLabel: string
  exerciseId?: string | null
  onSelectExercise?: (exerciseId: string) => void
}) {
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-base leading-none">
        {tile}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-medium">{title}</span>
        {subtitle != null && subtitle !== "" && (
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </>
  )

  if (onSelectExercise != null && exerciseId != null && exerciseId !== "") {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start gap-3 whitespace-normal px-2 py-2 font-normal"
        aria-label={instructionsLabel}
        onClick={() => onSelectExercise(exerciseId)}
      >
        {body}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm">
      {body}
    </div>
  )
}

interface DayCardProps {
  label: string
  /** Total Unified Day Sequence slots (solo + Circuit). */
  exerciseCount: number
  muscleFocus?: string | null
  items: DayCardItem[]
  to?: string
  linkState?: BuilderLocationState
}

export function DayCard({
  label,
  exerciseCount,
  muscleFocus,
  items,
  to,
  linkState,
}: DayCardProps) {
  const { t } = useTranslation("library")

  const card = (
    <Card className={cn(to && "transition-colors hover:bg-accent/40")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{label}</CardTitle>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              {t("exerciseCount", { count: exerciseCount })}
            </Badge>
            {to != null && (
              <ChevronRight
                className="h-4 w-4 text-muted-foreground"
                aria-hidden
              />
            )}
          </div>
        </div>
        {muscleFocus && (
          <Badge variant="secondary" className="w-fit text-[10px]">
            {muscleFocus}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 pt-0">
        <DayItemLines items={items} />
      </CardContent>
    </Card>
  )

  if (to == null) return card

  return (
    <Link
      to={to}
      state={linkState}
      className="block rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  )
}
