import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { getDefaultStore } from "jotai"
import { supabase } from "@/lib/supabase"
import { adaptForExperience, resolveEquipmentSwap } from "@/lib/generateProgram"
import { fetchExercisesByIds } from "@/lib/fetchExercisesByIds"
import { authAtom, hasProgramAtom, activeProgramIdAtom } from "@/store/atoms"
import type { UserProfile, ExerciseAlternative, ProgramTemplate } from "@/types/onboarding"
import type { Exercise } from "@/types/database"

interface GenerateProgramInput {
  template: ProgramTemplate | null
  profile: UserProfile
  activate?: boolean
}

const store = getDefaultStore()

const DAY_EMOJIS = ["💪", "🔥", "⚡", "🏋️", "🎯", "🚀"]

export function useGenerateProgram() {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ template, profile, activate = true }: GenerateProgramInput) => {
      if (!user) throw new Error("Not authenticated")

      if (activate) {
        const { error: deactivateError } = await supabase
          .from("programs")
          .update({ is_active: false })
          .eq("user_id", user.id)
          .eq("is_active", true)

        if (deactivateError) throw deactivateError
      }

      const programName = template?.name ?? "My Program"
      const { data: program, error: programError } = await supabase
        .from("programs")
        .insert({
          user_id: user.id,
          name: programName,
          template_id: template?.id ?? null,
          is_active: activate,
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

        // Pre-compute every swap target up front so we can batch-fetch the
        // replacement exercises in a single `.in()` call instead of firing one
        // `.eq + .single` per swapped exercise (previous N+1). The batch helper
        // chunks at 100 ids to respect PostgREST URL limits.
        const resolvedIdsToFetch = new Set<string>()
        for (const day of template.template_days) {
          for (const te of day.template_exercises) {
            const resolvedId = resolveEquipmentSwap(
              te.exercise_id,
              profile.equipment,
              alternatives,
            )
            if (resolvedId !== te.exercise_id) {
              resolvedIdsToFetch.add(resolvedId)
            }
          }
        }

        const fetchedSwapTargets =
          resolvedIdsToFetch.size > 0
            ? await fetchExercisesByIds([...resolvedIdsToFetch])
            : []
        const exerciseCache = fetchedSwapTargets.reduce(
          (map, ex) => map.set(ex.id, ex),
          new Map<string, Exercise>(),
        )

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

          const exerciseRows = day.template_exercises.map((te, idx) => {
            const resolvedId = resolveEquipmentSwap(
              te.exercise_id,
              profile.equipment,
              alternatives,
            )

            const exercise =
              resolvedId !== te.exercise_id
                ? exerciseCache.get(resolvedId)
                : te.exercise

            const adapted = adaptForExperience(
              te.rep_range,
              te.sets,
              te.rest_seconds,
              profile.experience,
            )

            const isDuration = exercise?.measurement_type === "duration"
            const isBodyweight = exercise?.equipment === "bodyweight"
            const defaultSec = exercise?.default_duration_seconds ?? 30

            return {
              workout_day_id: insertedDay.id,
              exercise_id: resolvedId,
              name_snapshot: exercise?.name ?? "Exercise",
              muscle_snapshot: exercise?.muscle_group ?? "",
              emoji_snapshot: exercise?.emoji ?? "🏋️",
              sets: adapted.sets,
              reps: isDuration ? "0" : adapted.reps,
              weight: "0",
              rest_seconds: adapted.restSeconds,
              sort_order: idx,
              target_duration_seconds: isDuration ? defaultSec : null,
              rep_range_min: adapted.repRangeMin ?? 8,
              rep_range_max: adapted.repRangeMax ?? 12,
              set_range_min: Math.max(1, adapted.sets - 1),
              set_range_max: Math.min(6, adapted.sets + 2),
              max_weight_reached: isBodyweight ? true : false,
              duration_range_min_seconds: isDuration ? Math.max(5, defaultSec - 10) : null,
              duration_range_max_seconds: isDuration ? defaultSec + 15 : null,
              duration_increment_seconds: isDuration ? 5 : null,
            }
          })

          const { error: exError } = await supabase
            .from("workout_exercises")
            .insert(exerciseRows)
          if (exError) throw exError
        }
      }

      return program.id as string
    },

    onSuccess: (programId, variables) => {
      if (variables.activate !== false) {
        store.set(hasProgramAtom, true)
        store.set(activeProgramIdAtom, programId)
        qc.invalidateQueries({ queryKey: ["workout-days"] })
        qc.invalidateQueries({ queryKey: ["active-program"] })
      }
      qc.invalidateQueries({ queryKey: ["user-programs"] })
    },
  })
}
