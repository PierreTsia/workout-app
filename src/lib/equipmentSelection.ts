import { EQUIPMENT_CATEGORY_MAP } from "@/lib/generatorConfig"
import type { EquipmentCategory } from "@/types/generator"

export function getEquipmentValuesForCategories(
  categories: EquipmentCategory[],
): string[] {
  const uniq = new Set<string>()
  for (const c of categories) {
    const vals = EQUIPMENT_CATEGORY_MAP[c]
    for (const v of vals) uniq.add(v)
  }
  return [...uniq]
}

/** Exclusive full gym: exactly `["full-gym"]`. */
export function isFullGymSelection(categories: EquipmentCategory[]): boolean {
  return categories.length === 1 && categories[0] === "full-gym"
}

/** Only bodyweight category selected — adaptive fallback to add bodyweight does not apply (same as legacy single bodyweight). */
export function isBodyweightOnlySelection(categories: EquipmentCategory[]): boolean {
  return categories.length === 1 && categories[0] === "bodyweight"
}

export function formatEquipmentLabelForName(categories: EquipmentCategory[]): string {
  if (isFullGymSelection(categories)) return "Gym"
  const parts: string[] = []
  if (categories.includes("bodyweight")) parts.push("Bodyweight")
  if (categories.includes("dumbbells")) parts.push("Dumbbells")
  return parts.join(" + ")
}

/**
 * Full gym is exclusive. Limited categories toggle on/off; deselecting the last limited option restores full gym.
 */
export function toggleEquipmentCategory(
  key: EquipmentCategory,
  current: EquipmentCategory[],
): EquipmentCategory[] {
  if (key === "full-gym") {
    return ["full-gym"]
  }

  const hasFullGym = current.includes("full-gym")
  if (hasFullGym) {
    return [key]
  }

  const set = new Set(current)
  if (set.has(key)) {
    set.delete(key)
    if (set.size === 0) return ["full-gym"]
    return sortLimitedCategories([...set])
  }
  set.add(key)
  return sortLimitedCategories([...set])
}

const LIMITED_ORDER: EquipmentCategory[] = ["bodyweight", "dumbbells"]

function sortLimitedCategories(cats: EquipmentCategory[]): EquipmentCategory[] {
  return LIMITED_ORDER.filter((k) => cats.includes(k))
}
