import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom, weightUnitAtom } from "@/store/atoms"
import type { UserGender, UserGoal, UserExperience, UserEquipment } from "@/types/onboarding"

const LBS_TO_KG = 0.453592

export interface UpdateUserProfilePayload {
  display_name: string | null
  avatar_url: string | null
  gender: UserGender
  age: number
  weight_kg_display: number
  goal: UserGoal
  experience: UserExperience
  equipment: UserEquipment
  training_days_per_week: number
  session_duration_minutes: number
}

export function useUpdateUserProfile() {
  const user = useAtomValue(authAtom)
  const weightUnit = useAtomValue(weightUnitAtom)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UpdateUserProfilePayload) => {
      if (!user) throw new Error("Not authenticated")

      const weightKg =
        weightUnit === "lbs"
          ? Math.round(payload.weight_kg_display * LBS_TO_KG * 10) / 10
          : payload.weight_kg_display

      const { data, error } = await supabase
        .from("user_profiles")
        .update({
          display_name: payload.display_name?.trim() ? payload.display_name.trim() : null,
          avatar_url: payload.avatar_url,
          gender: payload.gender,
          age: payload.age,
          weight_kg: weightKg,
          goal: payload.goal,
          experience: payload.experience,
          equipment: payload.equipment,
          training_days_per_week: payload.training_days_per_week,
          session_duration_minutes: payload.session_duration_minutes,
        })
        .eq("user_id", user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] })
      }
    },
  })
}
