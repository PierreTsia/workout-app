import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { getDefaultStore } from "jotai"
import { supabase } from "@/lib/supabase"
import { adaptForExperience, resolveEquipmentSwap } from "@/lib/generateProgram"
import { authAtom, hasProgramAtom, activeProgramIdAtom } from "@/store/atoms"
import type { UserProfile, ExerciseAlternative, ProgramTemplate } from "@/types/onboarding"
import type { Exercise } from "@/types/database"

interface GenerateProgramInput {
  template: ProgramTemplate | null
  profile: UserProfile
}

const store = getDefaultStore()

const DAY_EMOJIS = ["💪", "🔥", "⚡", "🏋️", "🎯", "🚀"]

export function useGenerateProgram() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ template, profile }: GenerateProgramInput) => {
      if (!user) throw new Error("Not authenticated")

      await supabase
        .from("programs")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("is_active", true)

      const programName = template?.name ?? "My Program"
      const { data: program, error: programError } = await supabase
        .from("programs")
        .insert({
          user_id: user.id,
          name: programName,
          template_id: template?.id ?? null,
          is_active: true,
        })
        .select("id")
        .single()

      if (programError) throw programError

      if (template) {
        let alternatives: ExerciseAlternative[] = []
        if (profile.equipment !== "gym") {
          const { data } = await supabase
            .from("exercise_alternatives")
            .select("exercise_id, alternative_exercise_id, equipment_context")
            .eq("equipment_context", profile.equipment)
          alternatives = (data ?? []) as ExerciseAlternative[]
        }

        const exerciseCache = new Map<string, Exercise>()

        for (const day of template.template_days) {
          const { data: insertedDay, error: dayError } = await supabase
            .from("workout_days")
            .insert({
              program_id: program.id,
              user_id: user.id,
              label: day.day_label,
              emoji: DAY_EMOJIS[day.sort_order % DAY_EMOJIS.length],
              sort_order: day.sort_order,
            })
            .select("id")
            .single()

          if (dayError) throw dayError

          const exerciseRows = await Promise.all(
            day.template_exercises.map(async (te, idx) => {
              const resolvedId = resolveEquipmentSwap(
                te.exercise_id,
                profile.equipment,
                alternatives,
              )

              let exercise = te.exercise
              if (resolvedId !== te.exercise_id) {
                if (!exerciseCache.has(resolvedId)) {
                  const { data } = await supabase
                    .from("exercises")
                    .select("*")
                    .eq("id", resolvedId)
                    .single()
                  if (data) exerciseCache.set(resolvedId, data as Exercise)
                }
                exercise = exerciseCache.get(resolvedId)
              }

              const adapted = adaptForExperience(
                te.rep_range,
                te.sets,
                te.rest_seconds,
                profile.experience,
              )

              return {
                workout_day_id: insertedDay.id,
                exercise_id: resolvedId,
                name_snapshot: exercise?.name ?? "Exercise",
                muscle_snapshot: exercise?.muscle_group ?? "",
                emoji_snapshot: exercise?.emoji ?? "🏋️",
                sets: adapted.sets,
                reps: adapted.reps,
                weight: "0",
                rest_seconds: adapted.restSeconds,
                sort_order: idx,
              }
            }),
          )

          const { error: exError } = await supabase
            .from("workout_exercises")
            .insert(exerciseRows)
          if (exError) throw exError
        }
      }

      return program.id as string
    },

    onSuccess: (programId) => {
      store.set(hasProgramAtom, true)
      store.set(activeProgramIdAtom, programId)
      qc.invalidateQueries({ queryKey: ["workout-days"] })
      qc.invalidateQueries({ queryKey: ["active-program"] })
    },
  })
}
