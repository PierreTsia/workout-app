import { useMutation } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import { normalizeLocale } from "@/lib/persistedLocale"
import { authAtom, weightUnitAtom } from "@/store/atoms"
import { getResolvedIANATimeZone } from "@/lib/trainingActivityTimezone"
import { AuthExpiredError, DisplayNameTakenError } from "@/hooks/profileErrors"
import type { UserGoal, UserExperience, UserEquipment, UserGender } from "@/types/onboarding"

interface ProfileInput {
  gender: UserGender
  age: number
  weight: number
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
  const { i18n } = useTranslation()

  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      if (!user) throw new Error("Not authenticated")

      const weightKg =
        weightUnit === "lbs"
          ? Math.round(input.weight * LBS_TO_KG * 10) / 10
          : input.weight

      const emailDefault = user.email?.trim() || null

      const timezone = getResolvedIANATimeZone()

      // Captured like `timezone`: whatever language they just read the
      // onboarding in is the best guess we will ever have. Normalized because
      // `i18n.language` can be "en-US" and the column's CHECK only accepts a
      // base subtag — an unnormalized write would fail the whole upsert.
      const locale = normalizeLocale(i18n.language)

      const { data, error } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            display_name: emailDefault,
            gender: input.gender,
            age: input.age,
            weight_kg: weightKg,
            goal: input.goal,
            experience: input.experience,
            equipment: input.equipment,
            training_days_per_week: input.training_days_per_week,
            session_duration_minutes: input.session_duration_minutes,
            timezone,
            locale,
          },
          { onConflict: "user_id" },
        )
        .select()
        .single()

      if (error) {
        // #348 — translate Postgres / PostgREST codes into typed errors
        // so the parent can branch UX (inline alert vs sign-out
        // redirect) and Sentry capture by `error_kind` instead of
        // landing in `window.onunhandledrejection` as an opaque
        // PostgrestError. Mirrors the mapping in `useUpdateUserProfile`.
        if (error.code === "23505") throw new DisplayNameTakenError()
        if (error.code === "PGRST301" || error.code === "42501") {
          throw new AuthExpiredError()
        }
        throw error
      }
      return data
    },
  })
}
