import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Exercise, WorkoutDay, WorkoutExercise } from "@/types/database"

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
    }: {
      dayId: string
      exercise: Exercise
      sortOrder: number
    }) => {
      const { error } = await supabase.from("workout_exercises").insert({
        workout_day_id: dayId,
        exercise_id: exercise.id,
        name_snapshot: exercise.name,
        muscle_snapshot: exercise.muscle_group,
        emoji_snapshot: exercise.emoji,
        sets: 3,
        reps: "12",
        weight: "0",
        rest_seconds: 90,
        sort_order: sortOrder,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
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
      const rows = exercises.map((exercise, i) => ({
        workout_day_id: dayId,
        exercise_id: exercise.id,
        name_snapshot: exercise.name,
        muscle_snapshot: exercise.muscle_group,
        emoji_snapshot: exercise.emoji,
        sets: 3,
        reps: "12",
        weight: "0",
        rest_seconds: 90,
        sort_order: startSortOrder + i,
      }))
      const { error } = await supabase.from("workout_exercises").insert(rows)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
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
    },
  })
}

export function useReorderDays(programId: string | null) {
  const user = useAtomValue(authAtom)
  const qc = useQueryClient()

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-days", user?.id, programId] })
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
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["workout-exercises", variables.dayId],
      })
    },
  })
}
