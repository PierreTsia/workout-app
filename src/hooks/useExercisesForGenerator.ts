import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Exercise } from "@/types/database"
import type { EquipmentCategory } from "@/types/generator"
import { getEquipmentValuesForCategories } from "@/lib/equipmentSelection"

export function useExercisesForGenerator(
  muscleGroups: string[],
  equipmentCategories: EquipmentCategory[] | null,
) {
  const equipmentValues =
    equipmentCategories && equipmentCategories.length > 0
      ? getEquipmentValuesForCategories(equipmentCategories)
      : []

  const isFullBody =
    muscleGroups.length === 0 || muscleGroups.includes("full-body")

  const sortedGroups = [...muscleGroups].sort()
  const equipmentKey =
    equipmentCategories && equipmentCategories.length > 0
      ? [...equipmentCategories].sort().join(",")
      : ""

  return useQuery({
    queryKey: ["exercises-for-generator", sortedGroups, equipmentKey],
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
    enabled: equipmentCategories !== null && equipmentCategories.length > 0,
  })
}
