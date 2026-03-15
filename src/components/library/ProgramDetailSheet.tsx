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
import { supabase } from "@/lib/supabase"
import { DayCard } from "@/components/library/DayCard"
import type { Program } from "@/types/onboarding"
import type { WorkoutDay, WorkoutExercise } from "@/types/database"

type DayWithExercises = WorkoutDay & { workout_exercises: WorkoutExercise[] }

interface ProgramDetailSheetProps {
  program: Program | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProgramDetailSheet({ program, open, onOpenChange }: ProgramDetailSheetProps) {
  const { t } = useTranslation("library")

  const { data: days, isLoading } = useQuery<DayWithExercises[]>({
    queryKey: ["program-detail", program?.id],
    enabled: !!program && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_days")
        .select("*, workout_exercises(*)")
        .eq("program_id", program!.id)
        .order("sort_order")

      if (error) throw error
      return data as DayWithExercises[]
    },
  })

  if (!program) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{program.name}</SheetTitle>
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
            {(days ?? [])
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((day) => (
                <DayCard
                  key={day.id}
                  label={`${day.emoji} ${day.label}`}
                  exerciseCount={day.workout_exercises.length}
                  exercises={day.workout_exercises.map((ex) => ({
                    id: ex.id,
                    emoji: ex.emoji_snapshot,
                    name: ex.name_snapshot,
                    sets: ex.sets,
                    reps: ex.reps,
                    restSeconds: ex.rest_seconds,
                    sortOrder: ex.sort_order,
                  }))}
                />
              ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
