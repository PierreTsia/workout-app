import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { deriveDurationRangeMax } from "@/lib/progression"
import { applySortOrders } from "@/lib/dayItems"
import { invalidateProgramIntentQueries } from "@/lib/programScore/queryKeys"
import { authAtom } from "@/store/atoms"
import type {
  Exercise,
  ExerciseListItem,
  WorkoutDay,
  WorkoutExercise,
} from "@/types/database"

export function useCreateDay(programId: string | null) {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      label,
      emoji,
      sortOrder,
    }: {
      label: string
      emoji: string
      sortOrder: number
    }) => {
      if (!programId) throw new Error("No program")
      const { data, error } = await supabase
        .from("workout_days")
        .insert({ user_id: user!.id, program_id: programId, label, emoji, sort_order: sortOrder })
        .select("id")
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-days", user?.id, programId] })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useUpdateDay(programId: string | null) {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      label,
      emoji,
    }: {
      id: string
      label?: string
      emoji?: string
    }) => {
      const updates: Record<string, string> = {}
      if (label !== undefined) updates.label = label
      if (emoji !== undefined) updates.emoji = emoji
      const { error } = await supabase
        .from("workout_days")
        .update(updates)
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-days", user?.id, programId] })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useDeleteDay(programId: string | null) {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (dayId: string) => {
      const { error } = await supabase
        .from("workout_days")
        .delete()
        .eq("id", dayId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-days", user?.id, programId] })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useAddExerciseToDay() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dayId,
      exercise,
      sortOrder,
      weight = "0",
    }: {
      dayId: string
      exercise: ExerciseListItem
      sortOrder: number
      weight?: string
    }) => {
      const isDuration = exercise.measurement_type === "duration"
      const isBodyweight = exercise.equipment === "bodyweight"
      const defaultSec = exercise.default_duration_seconds ?? 30

      const { error } = await supabase.from("workout_exercises").insert({
        workout_day_id: dayId,
        exercise_id: exercise.id,
        name_snapshot: exercise.name,
        muscle_snapshot: exercise.muscle_group,
        emoji_snapshot: exercise.emoji,
        sets: 3,
        reps: isDuration ? "0" : "12",
        weight,
        rest_seconds: 90,
        sort_order: sortOrder,
        target_duration_seconds: isDuration ? defaultSec : null,
        rep_range_min: 8,
        rep_range_max: 12,
        set_range_min: 2,
        set_range_max: 5,
        max_weight_reached: isBodyweight ? true : false,
        duration_range_min_seconds: isDuration ? Math.max(5, defaultSec - 10) : null,
        duration_range_max_seconds: isDuration ? deriveDurationRangeMax(defaultSec + 15) : null,
        duration_increment_seconds: isDuration ? 5 : null,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
      // Refresh the embedded `exerciseCount` on `useWorkoutDays` (DayList badge).
      qc.invalidateQueries({ queryKey: ["workout-days"] })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useAddExercisesToDay() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      dayId,
      exercises,
      startSortOrder,
    }: {
      dayId: string
      exercises: Exercise[]
      startSortOrder: number
    }) => {
      const rows = exercises.map((exercise, i) => {
        const isDuration = exercise.measurement_type === "duration"
        const isBodyweight = exercise.equipment === "bodyweight"
        const defaultSec = exercise.default_duration_seconds ?? 30
        return {
          workout_day_id: dayId,
          exercise_id: exercise.id,
          name_snapshot: exercise.name,
          muscle_snapshot: exercise.muscle_group,
          emoji_snapshot: exercise.emoji,
          sets: 3,
          reps: isDuration ? "0" : "12",
          weight: "0",
          rest_seconds: 90,
          sort_order: startSortOrder + i,
          target_duration_seconds: isDuration ? defaultSec : null,
          rep_range_min: 8,
          rep_range_max: 12,
          set_range_min: 2,
          set_range_max: 5,
          max_weight_reached: isBodyweight ? true : false,
          duration_range_min_seconds: isDuration ? Math.max(5, defaultSec - 10) : null,
          duration_range_max_seconds: isDuration ? deriveDurationRangeMax(defaultSec + 15) : null,
          duration_increment_seconds: isDuration ? 5 : null,
        }
      })
      const { error } = await supabase.from("workout_exercises").insert(rows)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
      qc.invalidateQueries({ queryKey: ["workout-days"] })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useUpdateExercise() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: {
      id: string
      dayId: string
      sets?: number
      reps?: string
      weight?: string
      rest_seconds?: number
      target_duration_seconds?: number | null
      rep_range_min?: number
      rep_range_max?: number
      set_range_min?: number
      set_range_max?: number
      weight_increment?: number | null
      max_weight_reached?: boolean
      duration_range_min_seconds?: number | null
      duration_range_max_seconds?: number | null
      duration_increment_seconds?: number | null
    }) => {
      const { id, dayId: _, ...fields } = vars
      const { error } = await supabase
        .from("workout_exercises")
        .update(fields)
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string; dayId: string }) => {
      const { error } = await supabase
        .from("workout_exercises")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
      qc.invalidateQueries({ queryKey: ["workout-days"] })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useSwapExerciseInDay() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: {
      id: string
      dayId: string
      exercise: ExerciseListItem
      weight: string
    }) => {
      const { error } = await supabase
        .from("workout_exercises")
        .update({
          exercise_id: vars.exercise.id,
          name_snapshot: vars.exercise.name,
          muscle_snapshot: vars.exercise.muscle_group,
          emoji_snapshot: vars.exercise.emoji,
          weight: vars.weight,
          max_weight_reached: false,
        })
        .eq("id", vars.id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useReorderDays(programId: string | null) {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()
  const daysKey = ["workout-days", user?.id, programId] as const

  return useMutation({
    mutationFn: async (days: Pick<WorkoutDay, "id" | "sort_order">[]) => {
      const promises = days.map((d) =>
        supabase
          .from("workout_days")
          .update({ sort_order: d.sort_order })
          .eq("id", d.id),
      )
      const results = await Promise.all(promises)
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onMutate: async (days) => {
      await qc.cancelQueries({ queryKey: daysKey })
      const previous = qc.getQueryData<WorkoutDay[]>(daysKey)
      if (previous) qc.setQueryData(daysKey, applySortOrders(previous, days))
      return { previous }
    },
    onError: (_err, _days, context) => {
      if (context?.previous) qc.setQueryData(daysKey, context.previous)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: daysKey })
      invalidateProgramIntentQueries(qc)
    },
  })
}

export function useReorderExercises() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      exercises,
    }: {
      dayId: string
      exercises: Pick<WorkoutExercise, "id" | "sort_order">[]
    }) => {
      const promises = exercises.map((ex) =>
        supabase
          .from("workout_exercises")
          .update({ sort_order: ex.sort_order })
          .eq("id", ex.id),
      )
      const results = await Promise.all(promises)
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onMutate: async ({ dayId, exercises }) => {
      const queryKey = ["workout-exercises", dayId] as const
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<WorkoutExercise[]>(queryKey)
      if (previous) qc.setQueryData(queryKey, applySortOrders(previous, exercises))
      return { previous }
    },
    onError: (_err, { dayId }, context) => {
      if (context?.previous) {
        qc.setQueryData(["workout-exercises", dayId], context.previous)
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
      invalidateProgramIntentQueries(qc)
    },
  })
}
