import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"
import type { EquipmentCategory } from "@/types/generator"
import { EQUIPMENT_CATEGORY_MAP } from "@/lib/generatorConfig"

export function useExercisesForGenerator(
  muscleGroups: string[],
  equipmentCategory: EquipmentCategory | null,
) {
  const equipmentValues = equipmentCategory
    ? EQUIPMENT_CATEGORY_MAP[equipmentCategory]
    : []

  const isFullBody =
    muscleGroups.length === 0 || muscleGroups.includes("full-body")

  const sortedGroups = [...muscleGroups].sort()

  return useQuery({
    queryKey: ["exercises-for-generator", sortedGroups, equipmentCategory],
    queryFn: async (): Promise<Exercise[]> => {
      let q = supabase.from("exercises").select("*")

      if (equipmentValues.length > 0) {
        q = q.in("equipment", [...equipmentValues])
      }

      if (!isFullBody && muscleGroups.length > 0) {
        q = q.in("muscle_group", muscleGroups)
      }

      q = q.order("muscle_group").order("name")

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Exercise[]
    },
    enabled: equipmentCategory !== null,
  })
}
