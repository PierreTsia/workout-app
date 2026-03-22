import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAtomValue } from "jotai"
import { getDefaultStore } from "jotai"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { authAtom, hasProgramAtom, activeProgramIdAtom } from "@/store/atoms"
import { CoachRationale } from "./CoachRationale"
import type { AIGeneratedProgram, GenerateProgramConstraints } from "@/types/aiProgram"

const DAY_EMOJIS = ["💪", "🔥", "⚡", "🏋️", "🎯", "🚀"]
const store = getDefaultStore()

interface AIProgramPreviewStepProps {
  program: AIGeneratedProgram
  constraints: GenerateProgramConstraints
  onRegenerate: () => void
  /** Post-create navigation (default: Library). Onboarding uses `/` for parity with template flow. */
  successReplacePath?: string
  onProgramCreated?: (programId: string) => void
}

export function AIProgramPreviewStep({
  program,
  constraints,
  onRegenerate,
  successReplacePath = "/library",
  onProgramCreated,
}: AIProgramPreviewStepProps) {
  const { t } = useTranslation("create-program")
  const navigate = useNavigate()
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  const [expandedDay, setExpandedDay] = useState<number | null>(0)
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate() {
    if (!user) return
    setIsCreating(true)

    try {
      const { error: deactivateError } = await supabase
        .from("programs")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("is_active", true)

      if (deactivateError) throw deactivateError

      const { data: prog, error: progError } = await supabase
        .from("programs")
        .insert({
          user_id: user.id,
          name: `AI: ${constraints.goal.replace("_", " ")} / ${constraints.daysPerWeek}d`,
          template_id: null,
          is_active: true,
        })
        .select("id")
        .single()

      if (progError) throw progError

      for (const [i, day] of program.days.entries()) {
        const { data: insertedDay, error: dayError } = await supabase
          .from("workout_days")
          .insert({
            program_id: prog.id,
            user_id: user.id,
            label: day.label,
            emoji: DAY_EMOJIS[i % DAY_EMOJIS.length],
            sort_order: i,
          })
          .select("id")
          .single()

        if (dayError) throw dayError

        const rows = day.exercises.map((ge, idx) => ({
          workout_day_id: insertedDay.id,
          exercise_id: ge.exercise.id,
          name_snapshot: ge.exercise.name,
          muscle_snapshot: ge.exercise.muscle_group,
          emoji_snapshot: ge.exercise.emoji ?? "🏋️",
          sets: ge.sets,
          reps: ge.reps,
          weight: "0",
          rest_seconds: ge.restSeconds,
          sort_order: idx,
        }))

        const { error: exError } = await supabase
          .from("workout_exercises")
          .insert(rows)
        if (exError) throw exError
      }

      store.set(hasProgramAtom, true)
      store.set(activeProgramIdAtom, prog.id)
      qc.invalidateQueries({ queryKey: ["workout-days"] })
      qc.invalidateQueries({ queryKey: ["active-program"] })
      qc.invalidateQueries({ queryKey: ["user-programs"] })

      toast.success(t("created"))
      onProgramCreated?.(prog.id)
      navigate(successReplacePath, { replace: true })
    } catch {
      toast.error(t("errorGeneric"))
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-8 pt-4">
      <h2 className="text-lg font-semibold">{t("previewTitle")}</h2>

      <CoachRationale rationale={program.rationale} />

      <div className="flex flex-col gap-2">
        {program.days.map((day, i) => {
          const isExpanded = expandedDay === i
          return (
            <div key={i} className="overflow-hidden rounded-xl border bg-card">
              <button
                onClick={() => setExpandedDay(isExpanded ? null : i)}
                className="flex w-full items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span>{DAY_EMOJIS[i % DAY_EMOJIS.length]}</span>
                  <div>
                    <div className="text-sm font-medium">{day.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {day.muscleFocus} · {t("exercises", { count: day.exercises.length })}
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isExpanded && (
                <div className="border-t px-3 pb-3">
                  {day.exercises.map((ge, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between border-b border-border/50 py-2 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{ge.exercise.emoji ?? "🏋️"}</span>
                        <span className="text-sm">{ge.exercise.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t("setsReps", { sets: ge.sets, reps: ge.reps })} · {t("restSeconds", { seconds: ge.restSeconds })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onRegenerate}
          disabled={isCreating}
        >
          {t("regenerate")}
        </Button>
        <Button
          className="flex-1"
          onClick={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("createProgram")
          )}
        </Button>
      </div>
    </div>
  )
}
