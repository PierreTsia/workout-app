import { z } from "zod"

export const programConstraintsSchema = z.object({
  daysPerWeek: z.number().int().min(2).max(7),
  duration: z.number().refine((v) => [15, 30, 45, 60, 90].includes(v)),
  equipmentCategory: z.enum(["bodyweight", "dumbbells", "full-gym"]),
  goal: z.enum(["strength", "hypertrophy", "endurance", "general_fitness"]),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  focusAreas: z.string().optional(),
  splitPreference: z.string().optional(),
})

export type ProgramConstraintsForm = z.infer<typeof programConstraintsSchema>

const EQUIPMENT_MAP: Record<string, string> = {
  gym: "full-gym",
  home: "dumbbells",
  minimal: "bodyweight",
}

export function mapEquipmentToCategory(profileEquipment: string): string {
  return EQUIPMENT_MAP[profileEquipment] ?? "full-gym"
}
