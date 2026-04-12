import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAddExerciseToDay } from "@/hooks/useBuilderMutations"
import { useUserPrograms } from "@/hooks/useUserPrograms"
import { useWorkoutDays } from "@/hooks/useWorkoutDays"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"
import type { Program } from "@/types/onboarding"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type Step = "program" | "day"

export interface AddExerciseToDaySheetProps {
  exercise: Exercise
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddExerciseToDaySheet({
  exercise,
  open,
  onOpenChange,
}: AddExerciseToDaySheetProps) {
  const { t } = useTranslation("library")
  const addExercise = useAddExerciseToDay()
  const { data: programs = [], isLoading: programsLoading } = useUserPrograms()

  const [step, setStep] = useState<Step>("program")
  const [programId, setProgramId] = useState<string | null>(null)

  const visiblePrograms = useMemo(
    () => programs.filter((p) => p.archived_at === null),
    [programs],
  )

  const { data: days = [], isLoading: daysLoading } = useWorkoutDays(programId)

  useEffect(() => {
    if (!open) {
      setStep("program")
      setProgramId(null)
    }
  }, [open])

  const handleSelectProgram = useCallback((p: Program) => {
    setProgramId(p.id)
    setStep("day")
  }, [])

  const handleBack = useCallback(() => {
    setStep("program")
    setProgramId(null)
  }, [])

  const handleSelectDay = useCallback(
    async (dayId: string) => {
      try {
        const { data: topRow, error } = await supabase
          .from("workout_exercises")
          .select("sort_order")
          .eq("workout_day_id", dayId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        const sortOrder = topRow ? topRow.sort_order + 1 : 0

        await addExercise.mutateAsync({
          dayId,
          exercise,
          sortOrder,
        })
        toast.success(t("addToSessionSuccess"))
        onOpenChange(false)
      } catch {
        toast.error(t("addToSessionError"))
      }
    },
    [addExercise, exercise, onOpenChange, t],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-4 text-left">
          <div className="flex items-center gap-2">
            {step === "day" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleBack}
                aria-label={t("addToSessionBack")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle className="text-left">
              {step === "program" ? t("addToSessionPickProgram") : t("addToSessionPickDay")}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {step === "program" && (
            <>
              {programsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : visiblePrograms.length === 0 ? (
                <div className="flex flex-col gap-3 py-4 text-center text-sm text-muted-foreground">
                  <p>{t("addToSessionNoPrograms")}</p>
                  <Button asChild variant="secondary" className="self-center">
                    <Link to="/create-program" onClick={() => onOpenChange(false)}>
                      {t("createProgram")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {visiblePrograms.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectProgram(p)}
                        className={cn(
                          "flex w-full items-center rounded-xl border border-border/60 bg-card px-4 py-3 text-left text-sm font-medium",
                          "transition-colors hover:bg-muted/50",
                        )}
                      >
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {step === "day" && programId && (
            <>
              {daysLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : days.length === 0 ? (
                <div className="flex flex-col gap-3 py-4 text-center text-sm text-muted-foreground">
                  <p>{t("addToSessionNoDays")}</p>
                  <Button asChild variant="secondary" className="self-center">
                    <Link
                      to={`/builder/${programId}`}
                      onClick={() => onOpenChange(false)}
                    >
                      {t("addToSessionOpenBuilder")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {days.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        disabled={addExercise.isPending}
                        onClick={() => handleSelectDay(d.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-left text-sm font-medium",
                          "transition-colors hover:bg-muted/50",
                          "disabled:opacity-60",
                        )}
                      >
                        <span className="text-lg" aria-hidden>
                          {d.emoji}
                        </span>
                        <span>{d.label}</span>
                        {addExercise.isPending && (
                          <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
