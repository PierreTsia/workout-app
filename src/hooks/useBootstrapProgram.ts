import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Exercise } from "@/types/database"

const PUSH_MUSCLES = new Set(["Pectoraux", "Épaules", "Triceps"])
const PULL_MUSCLES = new Set(["Dos", "Biceps", "Deltoïdes post.", "Trapèzes"])

const DAYS = [
  { label: "Lundi — Push", emoji: "💪", muscles: PUSH_MUSCLES },
  { label: "Mercredi — Pull", emoji: "🚣", muscles: PULL_MUSCLES },
  { label: "Vendredi — Legs", emoji: "🦵", muscles: null },
] as const

const SYSTEM_EXERCISES: Omit<Exercise, "id" | "created_at">[] = [
  { name: "Arnold Press Haltères", muscle_group: "Épaules", emoji: "🏋️", is_system: true },
  { name: "Papillon bras tendus", muscle_group: "Pectoraux", emoji: "🦅", is_system: true },
  { name: "Élévations latérales", muscle_group: "Épaules", emoji: "🙆", is_system: true },
  { name: "Skull Crusher incliné", muscle_group: "Triceps", emoji: "💀", is_system: true },
  { name: "Presse à cuisse", muscle_group: "Quadriceps", emoji: "🦵", is_system: true },
  { name: "Élévation mollet machine", muscle_group: "Mollets", emoji: "🦶", is_system: true },
  { name: "Crunch assis machine", muscle_group: "Abdos", emoji: "🔥", is_system: true },
  { name: "Rangées prise serrée neutre", muscle_group: "Dos", emoji: "🚣", is_system: true },
  { name: "Rangées prise large pronation", muscle_group: "Dos", emoji: "💪", is_system: true },
  { name: "Curls biceps inclinés", muscle_group: "Biceps", emoji: "💪", is_system: true },
  { name: "Papillon inverse", muscle_group: "Deltoïdes post.", emoji: "🦅", is_system: true },
  { name: "Shrugs haltères", muscle_group: "Trapèzes", emoji: "🤷", is_system: true },
  { name: "Soulevé de terre roumain", muscle_group: "Ischios / Bas du dos", emoji: "🏋️", is_system: true },
  { name: "Extension du dos machine", muscle_group: "Lombaires", emoji: "🔙", is_system: true },
  { name: "Crunch à genoux poulie", muscle_group: "Abdos", emoji: "🔥", is_system: true },
  { name: "Développé couché", muscle_group: "Pectoraux", emoji: "🏋️", is_system: true },
  { name: "Tirage latéral prise large", muscle_group: "Dos", emoji: "🚣", is_system: true },
  { name: "Pec Deck bras tendus", muscle_group: "Pectoraux", emoji: "🦅", is_system: true },
  { name: "Extension triceps corde", muscle_group: "Triceps", emoji: "💪", is_system: true },
  { name: "Curls stricts barre", muscle_group: "Biceps", emoji: "🦾", is_system: true },
  { name: "Extension de jambe machine", muscle_group: "Quadriceps", emoji: "🦵", is_system: true },
  { name: "Leg Curl assis", muscle_group: "Ischios", emoji: "🦵", is_system: true },
  { name: "Extension mollet machine", muscle_group: "Mollets", emoji: "🦶", is_system: true },
]

function classifyExercise(muscleGroup: string): number {
  if (PUSH_MUSCLES.has(muscleGroup)) return 0
  if (PULL_MUSCLES.has(muscleGroup)) return 1
  return 2
}

async function ensureSystemExercises(): Promise<Exercise[]> {
  const { data: existing, error: fetchErr } = await supabase
    .from("exercises")
    .select("*")
    .eq("is_system", true)

  if (fetchErr) {
    console.error("[Bootstrap] Failed to fetch exercises:", fetchErr)
    throw fetchErr
  }

  if (existing && existing.length > 0) return existing as Exercise[]

  console.log("[Bootstrap] No system exercises found — seeding...")
  const { data: inserted, error: insertErr } = await supabase
    .from("exercises")
    .insert(SYSTEM_EXERCISES)
    .select()

  if (insertErr) {
    console.error("[Bootstrap] Failed to seed exercises:", insertErr)
    throw insertErr
  }

  if (!inserted || inserted.length === 0) {
    throw new Error(
      "Exercises insert returned empty — check RLS on the exercises table",
    )
  }

  console.log(`[Bootstrap] Seeded ${inserted.length} exercises`)
  return inserted as Exercise[]
}

export function useBootstrapProgram() {
  const user = useAtomValue(authAtom)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated")
      console.log("[Bootstrap] Starting for user", user.id)

      const exercises = await ensureSystemExercises()

      const grouped: Exercise[][] = [[], [], []]
      for (const ex of exercises) {
        grouped[classifyExercise(ex.muscle_group)].push(ex)
      }

      for (let i = 0; i < DAYS.length; i++) {
        const day = DAYS[i]
        const dayExercises = grouped[i]

        const { data: dayRow, error: dayErr } = await supabase
          .from("workout_days")
          .insert({
            user_id: user.id,
            label: day.label,
            emoji: day.emoji,
            sort_order: i,
          })
          .select("id")
          .single()

        if (dayErr) {
          console.error(`[Bootstrap] Failed to insert day "${day.label}":`, dayErr)
          throw dayErr
        }
        if (!dayRow) {
          throw new Error(
            `workout_days insert returned empty for "${day.label}" — RLS blocking?`,
          )
        }

        console.log(`[Bootstrap] Created day "${day.label}" (${dayRow.id}) with ${dayExercises.length} exercises`)

        const exerciseRows = dayExercises.map((ex, idx) => ({
          workout_day_id: dayRow.id,
          exercise_id: ex.id,
          name_snapshot: ex.name,
          muscle_snapshot: ex.muscle_group,
          emoji_snapshot: ex.emoji,
          sets: 3,
          reps: "12",
          weight: "0",
          rest_seconds: 90,
          sort_order: idx,
        }))

        if (exerciseRows.length > 0) {
          const { error: weErr } = await supabase
            .from("workout_exercises")
            .insert(exerciseRows)

          if (weErr) {
            console.error("[Bootstrap] Failed to insert workout_exercises:", weErr)
            throw weErr
          }
        }
      }

      console.log("[Bootstrap] Complete")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-days"] })
    },
    onError: (err) => {
      console.error("[Bootstrap] Failed:", err)
    },
  })
}
