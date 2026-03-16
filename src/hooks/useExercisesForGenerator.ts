import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"
import type { EquipmentCategory } from "@/types/generator"
import { EQUIPMENT_CATEGORY_MAP } from "@/lib/generatorConfig"

export function useExercisesForGenerator(
  muscleGroup: string | "full-body" | null,
  equipmentCategory: EquipmentCategory | null,
) {
  const equipmentValues = equipmentCategory
    ? EQUIPMENT_CATEGORY_MAP[equipmentCategory]
    : []

  return useQuery({
    queryKey: ["exercises-for-generator", muscleGroup, equipmentCategory],
    queryFn: async (): Promise<Exercise[]> => {
      let q = supabase.from("exercises").select("*")

      if (equipmentValues.length > 0) {
        q = q.in("equipment", [...equipmentValues])
      }

      if (muscleGroup && muscleGroup !== "full-body") {
        q = q.eq("muscle_group", muscleGroup)
      }

      q = q.order("muscle_group").order("name")

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Exercise[]
    },
    enabled: muscleGroup !== null && equipmentCategory !== null,
  })
}
