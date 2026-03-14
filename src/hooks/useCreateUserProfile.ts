import { useMutation } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { supabase } from "@/lib/supabase"
import { authAtom, weightUnitAtom } from "@/store/atoms"
import type { UserGoal, UserExperience, UserEquipment, UserGender } from "@/types/onboarding"

interface ProfileInput {
  gender: UserGender | null
  age: number | null
  weight: number | null
  goal: UserGoal
  experience: UserExperience
  equipment: UserEquipment
  training_days_per_week: number
  session_duration_minutes: number
}

const LBS_TO_KG = 0.453592

export function useCreateUserProfile() {
  const user = useAtomValue(authAtom)
  const weightUnit = useAtomValue(weightUnitAtom)

  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      if (!user) throw new Error("Not authenticated")

      const weightKg =
        input.weight != null && weightUnit === "lbs"
          ? Math.round(input.weight * LBS_TO_KG * 10) / 10
          : input.weight

      const { data, error } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            gender: input.gender,
            age: input.age,
            weight_kg: weightKg,
            goal: input.goal,
            experience: input.experience,
            equipment: input.equipment,
            training_days_per_week: input.training_days_per_week,
            session_duration_minutes: input.session_duration_minutes,
          },
          { onConflict: "user_id" },
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
  })
}
