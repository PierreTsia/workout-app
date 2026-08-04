import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { LABEL_EXERCISE_SELECT } from "@/lib/exerciseSelects"
import { DayCard, type DayCardItem } from "@/components/library/DayCard"
import type { Program } from "@/types/onboarding"
import type {
  WorkoutDay,
  WorkoutExerciseWithLabel,
} from "@/types/database"

/** Block shape from the LABEL-select embed — only summary fields are used. */
type BlockSummaryRow = {
  id: string
  label: string | null
  rounds: number
  sort_order: number
  exercises: Array<{ id: string; position: number }>
}

type DayWithSequence = WorkoutDay & {
  workout_exercises: WorkoutExerciseWithLabel[]
  exercise_blocks: BlockSummaryRow[] | null
}

interface ProgramDetailSheetProps {
  program: Program | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (programId: string) => void
}

function toDayCardItems(
  exercises: WorkoutExerciseWithLabel[],
  blocks: BlockSummaryRow[],
): DayCardItem[] {
  const solos: DayCardItem[] = exercises.map((ex) => ({
    kind: "solo",
    id: ex.id,
    emoji: ex.emoji_snapshot,
    name: ex.name_snapshot,
    sets: ex.sets,
    reps: ex.reps,
    restSeconds: ex.rest_seconds,
    sortOrder: ex.sort_order,
  }))
  const circuits: DayCardItem[] = blocks.map((block) => ({
    kind: "circuit",
    id: block.id,
    label: block.label,
    rounds: block.rounds,
    exerciseCount: block.exercises.length,
    sortOrder: block.sort_order,
  }))
  return [...solos, ...circuits].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function ProgramDetailSheet({ program, open, onOpenChange, onEdit }: ProgramDetailSheetProps) {
  const { t } = useTranslation("library")

  const { data: days, isLoading } = useQuery<DayWithSequence[]>({
    queryKey: ["program-detail", program?.id],
    enabled: !!program && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_days")
        .select(
          `*, workout_exercises(*, exercise:exercises(${LABEL_EXERCISE_SELECT})), exercise_blocks(*, exercises:block_exercises(*, exercise:exercises(${LABEL_EXERCISE_SELECT})))`,
        )
        .eq("program_id", program!.id)
        .order("sort_order")

      if (error) throw error
      // Supabase client returns a loosely typed embed payload; DayWithSequence
      // matches LABEL_EXERCISE_SELECT (WorkoutExerciseWithLabel), not full Exercise.
      return (data ?? []) as DayWithSequence[]
    },
  })

  if (!program) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{program.name}</SheetTitle>
            {onEdit && !program.archived_at && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  onEdit(program.id)
                }}
              >
                {t("editProgram")}
              </Button>
            )}
          </div>
          <Badge variant="outline" className="w-fit text-[10px]">
            {t("generatedOn", { date: new Date(program.created_at).toLocaleDateString() })}
          </Badge>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {(days ?? []).map((day) => {
              const blocks = (day.exercise_blocks ?? []).map((block) => ({
                ...block,
                exercises: [...block.exercises].sort(
                  (a, b) => a.position - b.position,
                ),
              }))
              const items = toDayCardItems(day.workout_exercises, blocks)
              return (
                <DayCard
                  key={day.id}
                  label={`${day.emoji} ${day.label}`}
                  exerciseCount={items.length}
                  items={items}
                />
              )
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
